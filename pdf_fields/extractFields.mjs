// utility file for extracting field names from the CTR PDF
import { PDFDocument } from 'pdf-lib';
import https from 'https';
import fs from 'fs';
import path from 'path';

// Fetch PDF as buffer
async function fetchPdfBuffer(url) {
  return new Promise((resolve, reject) => {
    // fetch the PDF
    https.get(url, (res) => {
      // initialize the chunks
      const chunks = [];
      // on data, push the chunk
      res.on('data', (chunk) => chunks.push(chunk));
      // on end, resolve the buffer
      res.on('end', () => resolve(Buffer.concat(chunks)));
      // on error, reject
      res.on('error', reject);
    }).on('error', reject);
  });
}

// extract field names to CSV
async function extractFieldNamesToCSV(url, outputCsvPath) {
  const pdfBytes = await fetchPdfBuffer(url);
  // load the PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);
  // get the form
  const form = pdfDoc.getForm();
  // get the fields
  const fields = form.getFields();
  // get the field names
  const fieldNames = fields.map((field) => field.getName());

  // join the field names with a newline
  const csvContent = fieldNames.join('\n');
  // write the field names to the CSV file
  fs.writeFileSync(path.resolve(outputCsvPath), csvContent);
  // reflects output to console
  console.log(`Field names exported to ${outputCsvPath}`);
}

// set the URL and output path
const ctrPdfUrl = 'https://gacc.nifc.gov/gbcc/dispatch/ut-cdc/business/docs/CTR_Fillable_Edited.pdf';
const outputPath = './pdf_fields.csv';

// extract the field names to the CSV file
extractFieldNamesToCSV(ctrPdfUrl, outputPath);
