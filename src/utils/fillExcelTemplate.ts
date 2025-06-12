import ExcelJS from 'exceljs';
import { CrewMember, CrewInfo } from '../types/CTRTypes';

interface TemplateMapping {
  // Header Information
  crewName?: string;      // Cell for crew name
  crewNumber?: string;    // Cell for crew number
  fireName?: string;      // Cell for fire name
  fireNumber?: string;    // Cell for fire number
  date1?: string;         // Cell for first date
  date2?: string;         // Cell for second date

  // Data Start Position
  nameStartRow?: number;  // Starting row for crew member data
  nameCol?: string;       // Column for names
  classCol?: string;      // Column for classifications
  on1Col?: string;        // Column for first day ON times
  off1Col?: string;       // Column for first day OFF times
  on2Col?: string;        // Column for second day ON times
  off2Col?: string;       // Column for second day OFF times

  // Total Hours
  totalHoursRow?: number; // Row for total hours
  totalHoursCol?: string; // Column for total hours
}

// CTR Template Mapping
const CTR_TEMPLATE_MAPPING: TemplateMapping = {
  // Header Information
  crewName: 'A1',         // Crew Name
  crewNumber: 'F1',       // Crew Number
  fireName: 'C2',         // Fire Name
  fireNumber: 'F2',       // Fire Number
  date1: 'F4',           // First Date
  date2: 'H4',           // Second Date

  // Data Start Position
  nameStartRow: 6,        // Start from row 6
  nameCol: 'B',          // Names in column B (B6-B25)
  classCol: 'D',         // Classifications in column D
  on1Col: 'E',           // First day ON times in column E (E6-E25)
  off1Col: 'F',          // First day OFF times in column F (F6-F25)
  on2Col: 'G',           // Second day ON times in column G
  off2Col: 'H',          // Second day OFF times in column H

  // Total Hours
  totalHoursRow: 30,     // Total hours in row 30
  totalHoursCol: 'C'     // Total hours in column C
};

function setColumnWidths(worksheet: ExcelJS.Worksheet) {
  // Log current column properties
  console.log('Current column properties:', worksheet.columns.map(col => ({
    key: col.key,
    width: col.width,
    isCustomWidth: col.isCustomWidth
  })));

  // Define column widths in character units (not MDW)
  const columnWidths = [
    { key: 'A', width: 4.75 },
    { key: 'B', width: 15.73 },
    { key: 'C', width: 5.24 },
    { key: 'D', width: 4.95 },
    { key: 'E', width: 4.93 },
    { key: 'F', width: 4.93 },
    { key: 'G', width: 4.93 },
    { key: 'H', width: 4.93 },
    { key: 'I', width: 5.932 },
    { key: 'J', width: 25 },
    { key: 'K', width: 4.45 },
    { key: 'L', width: 5.4 },
    { key: 'M', width: 5.5 },
    { key: 'N', width: 5.45 },
    { key: 'O', width: 5.6 },
    { key: 'P', width: 5.7 }
  ];

  // Set each column width individually
  columnWidths.forEach(({ key, width }) => {
    const col = worksheet.getColumn(key);
    
    // Set width and ensure it's marked as custom width
    worksheet.getColumn(key).width = width;
    
    // Force column to be custom width
    if (col.eachCell) {
      col.eachCell({ includeEmpty: true }, (cell) => {
        const style = cell.style || {};
        style.alignment = style.alignment || {};
        style.alignment.wrapText = true;
        cell.style = style;
      });
    }
  });

  // Log final column properties
  console.log('Updated column properties:', worksheet.columns.map(col => ({
    key: col.key,
    width: col.width,
    isCustomWidth: col.isCustomWidth
  })));
}

function formatDateWithTwoDigitYear(dateStr: string): string {
  if (!dateStr) return '';
  
  // If the date contains a year, extract and format it
  const match = dateStr.match(/\d{4}/);
  if (match) {
    const fullYear = match[0];
    const twoDigitYear = fullYear.slice(-2);
    return dateStr.replace(fullYear, twoDigitYear);
  }
  
  return dateStr;
}

export async function fillExcelTemplate(
  data: CrewMember[],
  crewInfo: CrewInfo,
  days: string[],
  templateUrl = '/CTR_Template.xlsx',
  mapping: TemplateMapping = CTR_TEMPLATE_MAPPING
): Promise<ExcelJS.Workbook> {
  try {
    // Validate input data
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array');
    }

    // Create a new workbook and load the template
    const workbook = new ExcelJS.Workbook();
    const response = await fetch(templateUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.statusText}`);
    }
    
    const templateData = await response.arrayBuffer();
    await workbook.xlsx.load(templateData);
    
    // Get the first worksheet
    let worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      worksheet = workbook.getWorksheet('Sheet1');
    }
    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }
    if (!worksheet) {
      throw new Error('Template worksheet not found');
    }

    // Log initial worksheet state
    console.log('Initial worksheet state:', {
      name: worksheet.name,
      columnCount: worksheet.columnCount,
      rowCount: worksheet.rowCount,
      columns: worksheet.columns.map(col => ({
        key: col.key,
        width: col.width,
        isCustomWidth: col.isCustomWidth
      }))
    });

    // Fill header info - only update values, preserve formatting
    if (mapping.crewName) {
      worksheet.getCell(mapping.crewName).value = crewInfo?.crewName || '';
    }
    if (mapping.crewNumber) {
      worksheet.getCell(mapping.crewNumber).value = crewInfo?.crewNumber || '';
    }
    if (mapping.fireName) {
      worksheet.getCell(mapping.fireName).value = crewInfo?.fireName || '';
    }
    if (mapping.fireNumber) {
      worksheet.getCell(mapping.fireNumber).value = crewInfo?.fireNumber || '';
    }

    // Fill dates - format with 2-digit year
    if (mapping.date1) {
      worksheet.getCell(mapping.date1).value = formatDateWithTwoDigitYear(days?.[0] || '');
    }
    if (mapping.date2) {
      worksheet.getCell(mapping.date2).value = formatDateWithTwoDigitYear(days?.[1] || '');
    }

    // Fill crew member data - only update values
    const startRow = mapping.nameStartRow || 6;
    data.forEach((row, idx) => {
      if (!row || (!row.name && !row.classification)) return;
      
      const rowNum = startRow + idx;
      if (rowNum > startRow + 19) return; // Don't exceed 20 rows

      // Fill name and classification
      if (mapping.nameCol) {
        worksheet.getCell(`${mapping.nameCol}${rowNum}`).value = row.name || '';
      }
      if (mapping.classCol) {
        worksheet.getCell(`${mapping.classCol}${rowNum}`).value = row.classification || '';
      }

      // Fill times for day 1
      if (row.days?.[0]) {
        if (mapping.on1Col) {
          worksheet.getCell(`${mapping.on1Col}${rowNum}`).value = row.days[0].on || '';
        }
        if (mapping.off1Col) {
          worksheet.getCell(`${mapping.off1Col}${rowNum}`).value = row.days[0].off || '';
        }
      }

      // Fill times for day 2
      if (row.days?.[1]) {
        if (mapping.on2Col) {
          worksheet.getCell(`${mapping.on2Col}${rowNum}`).value = row.days[1].on || '';
        }
        if (mapping.off2Col) {
          worksheet.getCell(`${mapping.off2Col}${rowNum}`).value = row.days[1].off || '';
        }
      }
    });

    // Calculate and fill total hours
    const totalHours = calculateTotalHours(data);
    if (mapping.totalHoursRow && mapping.totalHoursCol) {
      worksheet.getCell(`${mapping.totalHoursCol}${mapping.totalHoursRow}`).value = totalHours;
    }

    // Only set protection without modifying any other properties
    worksheet.protect('', {
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      insertHyperlinks: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
      pivotTables: false,
      objects: true,
      scenarios: true
    });

    // Apply column widths as the final step
    setColumnWidths(worksheet);

    return workbook;
  } catch (error) {
    console.error('Error in fillExcelTemplate:', error);
    throw error;
  }
}

function calculateTotalHours(data: CrewMember[]): number {
  if (!Array.isArray(data)) return 0;
  
  let total = 0;
  for (const row of data) {
    if (!row || !row.days || !Array.isArray(row.days)) continue;
    
    for (const day of row.days) {
      if (!day) continue;
      const on = parseMilitaryTime(day.on);
      const off = parseMilitaryTime(day.off);
      if (on !== null && off !== null && off >= on) {
        total += off - on;
      }
    }
  }
  return Number(total.toFixed(2));
}

function parseMilitaryTime(time: string): number | null {
  if (!/^\d{4}$/.test(time)) return null;
  const h = parseInt(time.slice(0, 2), 10);
  const m = parseInt(time.slice(2, 4), 10);
  if (h > 23 || m > 59) return null;
  return h + m / 60;
} 