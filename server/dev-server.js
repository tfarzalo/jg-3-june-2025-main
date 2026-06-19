// Simple dev API server to host the reports router during local development
const express = require('express');
const reportsRouter = require('./reports/routes');
const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// Mount reports router at /api/reports
app.use('/api/reports', reportsRouter);

app.listen(port, () => {
  console.log(`Dev API server listening on http://localhost:${port}`);
});
