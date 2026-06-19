// reports/routes.cjs - Reporting routes scaffold (CommonJS)
const express = require('express');
const router = express.Router();
const archiver = require('archiver');
const { stringify } = require('csv-stringify');
const Pool = require('pg').Pool;
// Helper: stream query results using a simple cursor approach
async function streamQueryToCsv(queryText, params, csvStream) {
  const client = await pool.connect();
  try {
    const QueryStream = require('pg-query-stream');
    const qs = new QueryStream(queryText, params);
    const stream = client.query(qs);
    stream.on('data', (row) => {
      csvStream.write(row);
    });
    await new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } finally {
    client.release();
  }
}

// configure your DB connection here or import existing pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || ''
});

const DEMO_MODE = process.env.REPORTS_DEMO_MODE === 'true';

// Utility: map column key to SQL expression (aliases MUST match column keys)
function columnSqlForKey(key) {
  switch (key) {
    case 'work_order_id': return `wo.id AS work_order_id`;
    case 'painter_name': return `u.name AS painter_name`;
    case 'date': return `wo.scheduled_date::date AS date`;
    case 'community': return `p.name AS community`;
    case 'unit_number': return `wo.unit_number`;
    case 'unit_size': return `wo.unit_size`;
    case 'description': return `wo.description`;
    case 'bill_total': return `COALESCE(wo.bill_total, 0) AS bill_total`;
    case 'sub_total': return `COALESCE(wo.sub_total, 0) AS sub_total`;
    case 'created_at': return `wo.created_at AS created_at`;
    case 'approval':
      // Consider several possible fields indicating completion
      // Mark 'Yes' if completed, or if cancelled but has extra charges or a cancellation trip charge
      return `CASE WHEN (
        (wo.phase = 'completed' OR wo.status = 'completed' OR COALESCE(wo.completed_at, wo.completed_on) IS NOT NULL)
        OR (
          (lower(COALESCE(wo.phase, wo.status, '')) LIKE '%cancel%')
          AND (
            COALESCE(wo.sub_total,0) > 0
            OR COALESCE(wo.has_extra_charges,false) = true
            OR COALESCE(wo.cancellation_trip_charge_added,false) = true
          )
        )
      ) THEN 'Yes' ELSE 'No' END AS approval`;
    case 'total_profit':
      return `(COALESCE(wo.bill_total,0) - COALESCE(wo.sub_total,0)) AS total_profit`;
    case 'profit_margin':
      // percentage with two decimals (NULL when bill_total is zero)
      return `CASE WHEN COALESCE(wo.bill_total,0) = 0 THEN NULL ELSE ROUND((COALESCE(wo.bill_total,0) - COALESCE(wo.sub_total,0)) / NULLIF(COALESCE(wo.bill_total,0),0) * 100::numeric, 2) END AS profit_margin`;
    default:
      // passthrough: attempt to select column directly from wo
      return `${key}`;
  }
}

// Build SQL SELECT clause from an ordered list of column keys and optional phases filter
function buildSummarySql(columns, phasesFilter) {
  const selectExprs = columns.map(k => columnSqlForKey(k));
  let whereClause = `WHERE wo.scheduled_date BETWEEN $1 AND $2`;
  // phasesFilter can be: { type: 'all' } | { type: 'all_except_archived' } | { type: 'list', list: ['Completed','Pending'] }
  if (phasesFilter && phasesFilter.type === 'all_except_archived') {
    whereClause += ` AND lower(COALESCE(wo.phase, wo.status, '')) <> 'archived'`;
  } else if (phasesFilter && phasesFilter.type === 'list' && Array.isArray(phasesFilter.list) && phasesFilter.list.length > 0) {
    whereClause += ` AND COALESCE(wo.phase, wo.status, '') = ANY($3)`;
  }

  return `
    SELECT
      ${selectExprs.join(',\n      ')}
    FROM work_orders wo
    LEFT JOIN properties p ON p.id = wo.property_id
    LEFT JOIN users u ON u.id = wo.painter_id
    ${whereClause}
    ORDER BY wo.scheduled_date, wo.id
  `;
}

// GET /api/phases - return job phases
router.get('/phases', async (req, res) => {
  try {
    const q = await pool.query('SELECT id, job_phase_label FROM job_phases ORDER BY sort_order NULLS LAST, job_phase_label');
    res.json(q.rows || []);
  } catch (err) {
    console.error('phases list error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/reports/run
router.post('/run', async (req, res) => {
  try {
    const { from, to, templateId, columns: overrideColumns, template } = req.body || {};
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    // Determine columns to emit. Prefer explicit columns, then template param in body, then DB templateId.
    let columns = overrideColumns && Array.isArray(overrideColumns) && overrideColumns.length ? overrideColumns : null;

    let templateObj = template || null;

    if (!columns && templateId) {
      try {
        const tmplRes = await pool.query('SELECT columns, filters FROM report_templates WHERE id = $1 LIMIT 1', [templateId]);
        if (tmplRes.rows && tmplRes.rows[0]) {
          templateObj = tmplRes.rows[0];
          if (Array.isArray(tmplRes.rows[0].columns)) columns = tmplRes.rows[0].columns;
        }
      } catch (err) {
        console.warn('could not load template', err && err.message);
      }
    }

    if (!columns && templateObj && Array.isArray(templateObj.columns)) columns = templateObj.columns;

    // Default columns if none provided
    if (!columns) {
      columns = ['work_order_id','painter_name','date','community','unit_number','unit_size','description','bill_total','sub_total','created_at'];
    }

    // derive phasesFilter from templateObj.filters or req.body.template.filters
    let phasesFilter = null;
    const phasesParam = templateObj && templateObj.filters && templateObj.filters.phases ? templateObj.filters.phases : (req.body && req.body.filters && req.body.filters.phases ? req.body.filters.phases : null);
    if (Array.isArray(phasesParam)) {
      if (phasesParam.includes('ALL')) {
        phasesFilter = { type: 'all' };
      } else if (phasesParam.includes('ALL_EXCEPT_ARCHIVED')) {
        phasesFilter = { type: 'all_except_archived' };
      } else if (phasesParam.length > 0) {
        phasesFilter = { type: 'list', list: phasesParam };
      }
    }

    // Prepare response as ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="reports_${from}_${to}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // summary.csv
    const summaryCsv = stringify({ header: true, columns: columns });
    archive.append(summaryCsv, { name: 'reports/summary.csv' });

    const summarySql = buildSummarySql(columns, phasesFilter);
    const summaryParams = phasesFilter && phasesFilter.type === 'list' ? [from, to, phasesFilter.list] : [from, to];

    // If demo mode or DB unavailable, generate sample rows
    if (DEMO_MODE) {
      // create 10 sample rows matching requested columns
      for (let i = 1; i <= 10; i++) {
        const row = {};
        columns.forEach(col => {
          switch (col) {
            case 'work_order_id': row[col] = `WO-${i}`; break;
            case 'painter_name': row[col] = `Painter ${i}`; break;
            case 'date': row[col] = new Date().toISOString().slice(0,10); break;
            case 'community': row[col] = `Community ${i%3}`; break;
            case 'unit_number': row[col] = `${100+i}`; break;
            case 'unit_size': row[col] = `${(i%4)+1}BHK`; break;
            case 'description': row[col] = `Demo description ${i}`; break;
            case 'bill_total': row[col] = (200 + i*10).toFixed(2); break;
            case 'sub_total': row[col] = (150 + i*5).toFixed(2); break;
            case 'created_at': row[col] = new Date().toISOString(); break;
            case 'approval': row[col] = i % 2 === 0 ? 'Yes' : 'No'; break;
            case 'total_profit': row[col] = ( (200 + i*10) - (150 + i*5) ).toFixed(2); break;
            case 'profit_margin': row[col] = (( (200 + i*10) - (150 + i*5) ) / (200 + i*10) * 100).toFixed(2); break;
            default: row[col] = `demo_${col}_${i}`;
          }
        });
        summaryCsv.write(row);
      }
      summaryCsv.end();
    } else {
      // stream real DB rows
      streamQueryToCsv(summarySql, summaryParams, summaryCsv).catch(err => {
        console.error('summary stream error', err);
      }).then(() => {
        summaryCsv.end();
      });
    }

    // line_items.csv - one row per line item/extra; apply same phase filter via join to work_orders
    const linesColumns = ['work_order_id', 'line_id', 'item_type', 'description', 'quantity', 'unit_price', 'line_total'];
    const linesCsv = stringify({ header: true, columns: linesColumns });
    archive.append(linesCsv, { name: 'reports/line_items.csv' });

    let linesSql = `
      SELECT
        wol.work_order_id,
        wol.id AS line_id,
        wol.item_type,
        wol.description,
        wol.quantity,
        wol.unit_price,
        (wol.quantity * wol.unit_price) AS line_total
      FROM work_order_lines wol
      JOIN work_orders wo ON wo.id = wol.work_order_id
      WHERE wo.scheduled_date BETWEEN $1 AND $2
      ORDER BY wol.work_order_id, wol.id
    `;
    let linesParams = [from, to];
    if (phasesFilter && phasesFilter.type === 'list') {
      linesSql = linesSql.replace('WHERE wo.scheduled_date BETWEEN $1 AND $2', "WHERE wo.scheduled_date BETWEEN $1 AND $2 AND COALESCE(wo.phase, wo.status, '') = ANY($3)");
      linesParams = [from, to, phasesFilter.list];
    } else if (phasesFilter && phasesFilter.type === 'all_except_archived') {
      linesSql = linesSql.replace('WHERE wo.scheduled_date BETWEEN $1 AND $2', "WHERE wo.scheduled_date BETWEEN $1 AND $2 AND lower(COALESCE(wo.phase, wo.status, '')) <> 'archived'");
    }

    if (DEMO_MODE) {
      for (let i = 1; i <= 20; i++) {
        linesCsv.write({
          work_order_id: `WO-${Math.ceil(i/2)}`,
          line_id: i,
          item_type: 'service',
          description: `Demo line ${i}`,
          quantity: 1,
          unit_price: (25 + i).toFixed(2),
          line_total: (25 + i).toFixed(2)
        });
      }
      linesCsv.end();
    } else {
      streamQueryToCsv(linesSql, linesParams, linesCsv).catch(err => {
        console.error('lines stream error', err);
      }).then(() => {
        linesCsv.end();
      });
    }

    const readme = `Generated: ${new Date().toISOString()}\nRange: ${from} -> ${to}\nColumns: ${columns.join(',')}`;
    archive.append(readme, { name: 'reports/readme.txt' });

    // finalize when streams have finished writing. Wait a small interval for streams to close
    setTimeout(() => {
      archive.finalize().catch(err => console.error('archive finalize error', err));
    }, 1000);

  } catch (err) {
    console.error('reports run error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Template CRUD endpoints
// GET /api/reports/templates
router.get('/templates', async (req, res) => {
  try {
    const q = await pool.query('SELECT id, user_id, name, columns, sort, filters, created_at, updated_at FROM report_templates ORDER BY created_at DESC LIMIT 200');
    res.json({ templates: q.rows });
  } catch (err) {
    console.error('templates list error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/reports/templates
router.post('/templates', async (req, res) => {
  try {
    const { user_id, name, columns, sort, filters } = req.body || {};
    if (!name || !Array.isArray(columns)) return res.status(400).json({ error: 'name and columns required' });
    const q = await pool.query(
      `INSERT INTO report_templates (user_id, name, columns, sort, filters) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, columns, sort, filters, created_at`,
      [user_id || null, name, columns, sort || null, filters || null]
    );
    res.json({ template: q.rows[0] });
  } catch (err) {
    console.error('template create error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// PUT /api/reports/templates/:id
router.put('/templates/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, columns, sort, filters } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id required' });
    const q = await pool.query(
      `UPDATE report_templates SET name = COALESCE($2, name), columns = COALESCE($3, columns), sort = COALESCE($4, sort), filters = COALESCE($5, filters), updated_at = now() WHERE id = $1 RETURNING id, name, columns, sort, filters, updated_at`,
      [id, name || null, columns || null, sort || null, filters || null]
    );
    res.json({ template: q.rows[0] });
  } catch (err) {
    console.error('template update error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /api/reports/templates/:id
router.delete('/templates/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    await pool.query('DELETE FROM report_templates WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('template delete error', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
