import { CrewMember, CrewInfo } from '../types/CTRTypes';
import ExcelJS from 'exceljs';

// Define the expected cell locations in the Excel template
export const EXCEL_CELL_MAPPING = {
  crewInfo: {
    crewName: 'A1',
    crewNumber: 'F1',
    fireName: 'C2',
    fireNumber: 'F2'
  },
  dates: {
    date1: 'F4',
    date2: 'H4'
  },
  crewMembers: {
    startRow: 6, // Excel row 6 is where crew member data starts
    columns: {
      name: 'B',
      classification: 'D',
      on1: 'E',
      off1: 'F',
      on2: 'G',
      off2: 'H'
    }
  }
};

function getMergedCellValue(worksheet: ExcelJS.Worksheet, cellAddress: string): string {
  const cell = worksheet.getCell(cellAddress);
  
  // Debug logging
  console.log(`Reading cell ${cellAddress}:`, {
    value: cell.value,
    type: cell.type,
    text: cell.text,
    formula: cell.formula
  });

  // Handle different types of cell values
  if (cell.value === null || cell.value === undefined) {
    return '';
  }

  // If the cell value is a rich text object
  if (cell.type === ExcelJS.ValueType.RichText) {
    const richTextValue = cell.value as ExcelJS.CellRichTextValue;
    return richTextValue.richText.map(rt => rt.text).join('');
  }

  // For dates, return the formatted text
  if (cell.type === ExcelJS.ValueType.Date) {
    return cell.text || '';
  }

  // For all other types, convert to string
  return cell.value?.toString() || '';
}

export function mapExcelToData(worksheet: ExcelJS.Worksheet): { crewInfo: CrewInfo; crewMembers: CrewMember[] } {
  console.log('Starting Excel import...');
  
  // Extract crew info from specific cells
  const crewInfo: CrewInfo = {
    crewName: getMergedCellValue(worksheet, EXCEL_CELL_MAPPING.crewInfo.crewName) || '',
    crewNumber: getMergedCellValue(worksheet, EXCEL_CELL_MAPPING.crewInfo.crewNumber) || '',
    fireName: getMergedCellValue(worksheet, EXCEL_CELL_MAPPING.crewInfo.fireName) || '',
    fireNumber: getMergedCellValue(worksheet, EXCEL_CELL_MAPPING.crewInfo.fireNumber) || ''
  };

  console.log('Extracted crew info:', crewInfo);

  // Extract dates from specific cells
  const date1 = getMergedCellValue(worksheet, EXCEL_CELL_MAPPING.dates.date1) || '';
  const date2 = getMergedCellValue(worksheet, EXCEL_CELL_MAPPING.dates.date2) || '';

  console.log('Extracted dates:', { date1, date2 });

  const crewMembers: CrewMember[] = [];
  let row = EXCEL_CELL_MAPPING.crewMembers.startRow;
  
  // Read up to 20 crew members (rows 6-25)
  while (row <= 25) {
    // Get the name cell for this row
    const nameCell = worksheet.getCell(`${EXCEL_CELL_MAPPING.crewMembers.columns.name}${row}`);
    const nameCellValue = getMergedCellValue(worksheet, `${EXCEL_CELL_MAPPING.crewMembers.columns.name}${row}`);
    
    console.log(`Reading row ${row}, name cell:`, nameCellValue);
    
    // If no name is found in the expected cell, stop reading
    if (!nameCellValue) {
      console.log(`No name found in row ${row}, stopping import`);
      break;
    }

    // Create crew member object with data from specific cells
    const crewMember: CrewMember = {
      name: nameCellValue,
      classification: getMergedCellValue(worksheet, `${EXCEL_CELL_MAPPING.crewMembers.columns.classification}${row}`),
      days: [
        {
          date: date1,
          on: getMergedCellValue(worksheet, `${EXCEL_CELL_MAPPING.crewMembers.columns.on1}${row}`),
          off: getMergedCellValue(worksheet, `${EXCEL_CELL_MAPPING.crewMembers.columns.off1}${row}`)
        },
        {
          date: date2,
          on: getMergedCellValue(worksheet, `${EXCEL_CELL_MAPPING.crewMembers.columns.on2}${row}`),
          off: getMergedCellValue(worksheet, `${EXCEL_CELL_MAPPING.crewMembers.columns.off2}${row}`)
        }
      ]
    };

    console.log(`Crew member data for row ${row}:`, crewMember);
    crewMembers.push(crewMember);
    row++;
  }

  console.log('Total crew members imported:', crewMembers.length);
  return { crewInfo, crewMembers };
}

export function mapDataToExcel(worksheet: ExcelJS.Worksheet, data: { crewInfo: CrewInfo; crewMembers: CrewMember[] }): void {
  // Set crew info in specific cells
  worksheet.getCell(EXCEL_CELL_MAPPING.crewInfo.crewName).value = data.crewInfo.crewName;
  worksheet.getCell(EXCEL_CELL_MAPPING.crewInfo.crewNumber).value = data.crewInfo.crewNumber;
  worksheet.getCell(EXCEL_CELL_MAPPING.crewInfo.fireName).value = data.crewInfo.fireName;
  worksheet.getCell(EXCEL_CELL_MAPPING.crewInfo.fireNumber).value = data.crewInfo.fireNumber;

  // Set dates in specific cells
  if (data.crewMembers[0]?.days[0]) {
    worksheet.getCell(EXCEL_CELL_MAPPING.dates.date1).value = data.crewMembers[0].days[0].date;
  }
  if (data.crewMembers[0]?.days[1]) {
    worksheet.getCell(EXCEL_CELL_MAPPING.dates.date2).value = data.crewMembers[0].days[1].date;
  }

  // Set crew member data in specific cells
  data.crewMembers.forEach((member, index) => {
    const row = EXCEL_CELL_MAPPING.crewMembers.startRow + index;
    
    // Set name and classification
    worksheet.getCell(`${EXCEL_CELL_MAPPING.crewMembers.columns.name}${row}`).value = member.name;
    worksheet.getCell(`${EXCEL_CELL_MAPPING.crewMembers.columns.classification}${row}`).value = member.classification;
    
    // Set first day's times
    if (member.days[0]) {
      worksheet.getCell(`${EXCEL_CELL_MAPPING.crewMembers.columns.on1}${row}`).value = member.days[0].on;
      worksheet.getCell(`${EXCEL_CELL_MAPPING.crewMembers.columns.off1}${row}`).value = member.days[0].off;
    }
    
    // Set second day's times
    if (member.days[1]) {
      worksheet.getCell(`${EXCEL_CELL_MAPPING.crewMembers.columns.on2}${row}`).value = member.days[1].on;
      worksheet.getCell(`${EXCEL_CELL_MAPPING.crewMembers.columns.off2}${row}`).value = member.days[1].off;
    }
  });
} 