// Maps table data to PDF field names as extracted from pdf_fields.csv
import { calculateTotalHours } from './timeCalculations';

export function mapToPDFFields(data: any[], crewInfo?: any, signature?: { name: string; signature: string }) {
  const fields: Record<string, string> = {};
  
  // Crew info fields
  if (crewInfo) {
    fields['1 CREW NAME'] = crewInfo.crewName || '';
    fields['2 CREW NUMER'] = crewInfo.crewNumber || '';
    fields['4FIRE NAME'] = crewInfo.fireName || '';
    fields['5 FIRE NUMBER'] = crewInfo.fireNumber || '';

    // Handle checkbox states and map to remarks fields
    if (crewInfo.checkboxStates) {
      const remarks: string[] = [];
      
      // Calculate total hours
      const totalHours = calculateTotalHours(data);
      const formattedTotalHours = totalHours.toFixed(2);

      // First row: HOTLINE/Travel + Total Hours
      const firstRowText = crewInfo.checkboxStates?.hotline ? 'HOTLINE' : 
                          (crewInfo.checkboxStates?.travel ? 'Travel' : '');
      fields['lRfMARKSRow1'] = firstRowText ? `${firstRowText}                Total Hours: ${formattedTotalHours}` : `Total Hours: ${formattedTotalHours}`;
      
      // Add remaining remarks with updated text
      if (crewInfo.checkboxStates.noMealsLodging && crewInfo.checkboxStates.noMeals) {
        remarks.push('Self Sufficient - No Meals & No Lodging Provided');
      } else if (crewInfo.checkboxStates.noMealsLodging) {
        remarks.push('Self Sufficient - No Meals Provided');
      } else if (crewInfo.checkboxStates.noMeals) {
        remarks.push('Self Sufficient - No Lodging Provided');
      }
      if (crewInfo.checkboxStates.travel && crewInfo.checkboxStates.hotline) {
        remarks.push('Travel');
      }
      if (crewInfo.checkboxStates.noLunch) {
        remarks.push('No Lunch Taken due to Uncontrolled Fire Line');
      }

      // Add any custom entries
      if (crewInfo.customEntries?.length) {
        remarks.push(...crewInfo.customEntries);
      }

      console.log('Remarks to be added:', remarks);

      // Map remarks to the available fields (up to 6 rows)
      remarks.slice(0, 6).forEach((remark, index) => {
        const fieldName = `lRfMARKSRow${index + 2}`; // Start from row 2 since row 1 is used for HOTLINE/Travel
        fields[fieldName] = remark;
        console.log(`Setting ${fieldName} to "${remark}"`);
      });
    } else {
      // If no checkbox states, add default HOTLINE with total hours
      const totalHours = calculateTotalHours(data);
      const formattedTotalHours = totalHours.toFixed(2);
      fields['lRfMARKSRow1'] = `HOTLINE                Total Hours: ${formattedTotalHours}`;
      console.log('No checkbox states found in crewInfo, adding default HOTLINE with total hours:', crewInfo);
    }
  }

  // Populate DATE and DATE_2 fields from the first row's days if available
  if (data[0]?.days[0]) {
    fields['DATE'] = data[0].days[0].date;
  }
  if (data[0]?.days[1]) {
    fields['DATE_2'] = data[0].days[1].date;
  }

  // Only map rows that have actual data
  data.forEach((row, idx) => {
    // Skip rows that don't have a name or classification
    if (!row?.name && !row?.classification) return;

    const rowNum = idx + 1;
    
    // Use the exact field names from your CSV
    fields[`NAME OF EMPLOYEERow${rowNum}`] = row.name || '';
    
    // Try multiple field name variations for classification
    const classificationFieldVariations = [
      `ClASS IF CATIONRow${rowNum}`,
      `CtASSIF CATIONRow${rowNum}`,
      `CLASSIFICATIONRow${rowNum}`,
      `CLASSRow${rowNum}`,
      `CATIONRow${rowNum}`
    ];
    
    // Fill all field name variations to ensure data appears in the correct field
    classificationFieldVariations.forEach(fieldName => {
      fields[fieldName] = row.classification || '';
    });

    // Debug: Log classification values being mapped
    console.log(`🔍 pdfFieldMapper: PDF Field Mapping - Row ${rowNum}:`, {
      fieldName: classificationFieldVariations[0],
      fieldVariations: classificationFieldVariations,
      classification: row.classification,
      classificationLength: row.classification?.length || 0,
      name: row.name,
      rowData: row,
      filledFields: classificationFieldVariations.map(field => ({ field, value: row.classification || '' }))
    });

    // Day 1
    if (row.days?.[0]) {
      fields[`ONRow${rowNum}`] = row.days[0].on || '';
      fields[`OFFRow${rowNum}`] = row.days[0].off || '';
    }

    // Day 2
    if (row.days?.[1]) {
      fields[`ONRow${rowNum}_2`] = row.days[1].on || '';
      fields[`OFFRow${rowNum}_2`] = row.days[1].off || '';
    }
  });

  return fields;
} 