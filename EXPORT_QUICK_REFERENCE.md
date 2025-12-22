# 📋 Export System Quick Reference

## ⚡ Quick Facts

### Default Date Range
- **Start**: 30 days before today
- **End**: Today
- **Resets**: Every time export dialog opens

### Export Formats
- **CSV**: Best for comprehensive data, spreadsheets, analysis
- **PDF**: Best for printing, sharing, presentations

### Column Limit Recommendations
- **CSV**: No limit - include all columns you need
- **PDF**: 8-12 columns recommended for best formatting

---

## 🎯 Common Export Scenarios

### Scenario 1: Quick Job List for Print
**Format**: PDF  
**Columns**: Work Order #, Phase, Property, Unit #, Scheduled Date  
**Date Range**: Last 30 days (default)  
**Result**: Clean, printable job list

### Scenario 2: Full Billing Analysis
**Format**: CSV  
**Columns**: All billing breakdown columns + job info  
**Date Range**: Custom (entire quarter or year)  
**Result**: Complete financial data for analysis

### Scenario 3: Weekly Status Report
**Format**: PDF  
**Columns**: WO #, Phase, Property, Unit #, Date, Invoice Status  
**Date Range**: Last 7 days (modify from default)  
**Result**: Professional weekly summary

### Scenario 4: Complete Job Archive
**Format**: CSV  
**Columns**: All 47 columns selected  
**Date Range**: All time (modify dates)  
**Result**: Complete job database backup

---

## 🔄 Export Workflow

```
1. Click "Export" button
   ↓
2. Choose CSV or PDF
   ↓
3. Review date range (defaults to last 30 days)
   ↓
4. Modify dates if needed
   ↓
5. Select columns to include
   ↓
6. Click "Export"
   ↓
7. File downloads automatically
```

---

## 📁 File Naming

### CSV Format
`[document_title]_YYYY-MM-DD.csv`  
Example: `active_jobs_2025-11-23.csv`

### PDF Format
`[document_title]_-_YYYY-MM-DD_to_YYYY-MM-DD.pdf`  
Example: `active_jobs_-_2025-10-24_to_2025-11-23.pdf`

---

## 🎨 PDF Export Tips

✅ **DO**:
- Select 8-12 essential columns
- Use for presentations and printing
- Export smaller date ranges for better formatting
- Use landscape orientation (automatic)

❌ **DON'T**:
- Select all 47 columns (use CSV instead)
- Expect perfect formatting with 20+ columns
- Use for detailed data analysis (use CSV)
- Try to fit long descriptions (they'll truncate)

---

## 💾 CSV Export Tips

✅ **DO**:
- Select all columns you need
- Use for financial analysis
- Export large date ranges
- Open in Excel, Google Sheets, or data tools
- Use for complete backups

✅ **ADVANTAGES**:
- No column limit
- No text truncation
- Perfect for data analysis
- Works with any date range
- Maintains full data fidelity

---

## 📊 Column Categories (47 Total)

### Essential (8 columns)
- Work Order #, Phase, Property, Unit #, Scheduled Date, Job Type, Unit Size, Total Bill

### Financial (12 columns)
- All billing breakdown fields (base, additional services, extra charges, totals)

### Detailed (21 columns)
- All work order fields (paint details, extra services, etc.)

### Administrative (6 columns)
- Dates, descriptions, comments, invoice status

---

## 🚀 Performance

### CSV Export
- **Speed**: ~5 seconds for 100 jobs
- **Limit**: 10,000 jobs
- **Memory**: Optimized batch processing

### PDF Export  
- **Speed**: ~3 seconds for 100 jobs
- **Limit**: Recommended 500 jobs or less
- **File Size**: ~100KB per 100 jobs

---

## ⚙️ Settings Persistence

### Saved Between Sessions
- ✅ Column selections
- ✅ Section expand/collapse states
- ✅ Export type preference (CSV/PDF)

### Reset Every Time
- ✅ Date range (always last 30 days)
- ✅ Export dialog state

---

## 🔍 Troubleshooting

### "No jobs match the selected date range"
**Solution**: Adjust start date to go further back

### PDF looks crowded
**Solution**: Select fewer columns (8-12 recommended)

### CSV won't open in Excel
**Solution**: Right-click → Open With → Excel

### Export takes too long
**Solution**: Reduce date range or use fewer billing columns

### Missing billing data in export
**Solution**: Ensure jobs have work orders created

---

## 📞 Support

For issues or questions about exports:
1. Check this quick reference
2. Review detailed docs: `EXPORT_SYSTEM_COMPLETE_SUMMARY.md`
3. Check specific guides: `CSV_VS_PDF_EXPORT_GUIDE.md`

---

## ✨ Key Improvements (Nov 2025)

- ✅ PDF now matches CSV columns (47 total)
- ✅ Landscape orientation for PDF
- ✅ Default date range (30 days)
- ✅ Date range in PDF filename
- ✅ Warning notice for PDF
- ✅ Enhanced text wrapping
- ✅ Better performance

---

**Last Updated**: November 23, 2025  
**Status**: ✅ All Features Complete
