import React, { useRef } from 'react';
import { CrewMember, CrewInfo } from '../types/CTRTypes';
import { calculateTotalHours } from '../utils/timeCalculations';

interface PrintableTableProps {
  data: CrewMember[];
  crewInfo: CrewInfo;
  days: string[];
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Convert from YYYY-MM-DD to YY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0].slice(2)}-${parts[1]}-${parts[2]}`;
  }
  return dateStr;
};

const PrintableTable: React.FC<PrintableTableProps> = ({ data, crewInfo, days }) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // Create a temporary div for printing
    const printContainer = document.createElement('div');
    printContainer.style.display = 'none';
    printContainer.className = 'print-container';
    document.body.appendChild(printContainer);

    // Create a style element for print media
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @media print {
        body > *:not(.print-container) {
          display: none !important;
        }
        .print-container {
          display: block !important;
        }
      }
    `;
    document.head.appendChild(styleElement);

    // HTML template
    const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <style>
        @page {
            margin-top: 0.45cm;
            margin-left: 0.35cm;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 6pt;
            margin: 0;
            padding: 0;
        }

        table {
            border-collapse: collapse;
            margin: 0;
            padding: 0;
            table-layout: fixed;
        }

        th, td {
            border: none;
            text-align: center;
            vertical-align: middle;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            line-height: 1;
            height: 0.435cm;
        }

        thead th {
            visibility: hidden;
        }

        td:nth-child(4), td:nth-child(5), td:nth-child(6), td:nth-child(7) {
            text-align: center;
        }

        td:nth-child(2) {
            text-align: center;
        }

        td:nth-child(3) {
            text-align: center;
        }

        td:nth-child(1) {
            text-align: center;
        }

        @media print {
            html, body {
                margin: 0;
                padding: 0;
            }
            table, tr, td, th {
                page-break-inside: avoid;
                break-inside: avoid;
            }
        }

        .header-table td {
            height: 0.68cm;
            padding: 0;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <!-- Crew Info Table -->
    <table class="header-table">
        <colgroup>
            <col style="width: 7cm">
            <col style="width: 2.99cm">
        </colgroup>
        <tr style="height: 0.68cm;">
            <td style="text-align: center;">Dust Busters Plus LLC</td>
            <td style="text-align: right;"></td>
        </tr>
    </table>

    <!-- Fire Info Table -->
    <table class="header-table">
        <colgroup>
            <col style="width: 4cm">
            <col style="width: 2.99cm">
            <col style="width: 2.99cm">
        </colgroup>
        <tr style="height: 0.435cm;">
            <td></td>
            <td style="text-align: right;">Fire Name:</td>
            <td style="text-align: right;">Fire Number:</td>
        </tr>
    </table>

    <!-- Date Headers Table -->
    <table class="header-table" style="margin-bottom: 0.1cm;">
        <colgroup>
            <col style="width: 6.2cm">
            <col style="width: 1.85cm">
            <col style="width: 1.85cm">
        </colgroup>
        <tr style="height: 0.4cm;">
            <td></td>
            <td style="text-align: right; vertical-align: bottom;"></td>
            <td style="text-align: right; vertical-align: bottom;"></td>
        </tr>
    </table>

    <!-- Main Time Table -->
    <table class="time-table">
        <colgroup>
            <col style="width: 0.9cm">  <!-- No -->
            <col style="width: 4.25cm">  <!-- Name -->
            <col style="width: 1.15cm">  <!-- Class -->
            <col style="width: 0.95cm">  <!-- On -->
            <col style="width: 0.95cm">  <!-- Off -->
            <col style="width: 0.95cm">  <!-- On -->
            <col style="width: 0.95cm">  <!-- Off -->
        </colgroup>
        <thead>
            <tr>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
                <th></th>
            </tr>
        </thead>
        <tbody>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
    </table>

    <!-- Remarks Table -->
    <table class="remarks-table" style="margin-top: 0.635cm;">
        <colgroup>
            <col style="width: 10.1cm">
        </colgroup>
        <tbody id="remarks-data">
            <tr><td style="text-align: left; height: 0.435cm;"></td></tr>
            <tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;">placeholder.</td></tr>
            <tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;">placeholder.</td></tr>
            <tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;">placeholder.</td></tr>
            <tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;">placeholder.</td></tr>
            <tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;">placeholder.</td></tr>
            <tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;">placeholder.</td></tr>
        </tbody>
    </table>
</body>
</html>`;

    // Create a temporary div to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = template;

    try {
      // Update crew info - first table
      const firstTable = tempDiv.querySelector('.header-table');
      if (firstTable) {
        const cells = firstTable.querySelectorAll('td');
        if (cells[0]) cells[0].textContent = crewInfo.crewName || 'Dust Busters Plus LLC';
        if (cells[1]) cells[1].textContent = crewInfo.crewNumber || '';
      }

      // Update fire info - second table
      const tables = tempDiv.querySelectorAll('.header-table');
      if (tables[1]) {
        const cells = tables[1].querySelectorAll('td');
        if (cells[1]) cells[1].textContent = `${crewInfo.fireName || ''}`;
        if (cells[2]) cells[2].textContent = `${crewInfo.fireNumber || ''}`;
      }

      // Update dates - third table
      if (tables[2]) {
        const cells = tables[2].querySelectorAll('td');
        if (cells[1]) cells[1].textContent = formatDate(days[0] || '');
        if (cells[2]) cells[2].textContent = formatDate(days[1] || '');
      }

      // Get the main table and its rows
      const allTables = tempDiv.querySelectorAll('table');
      const mainTable = allTables[allTables.length - 2]; // Get the second to last table (time-table)
      if (mainTable) {
        // First, ensure thead row is empty
        const theadRow = mainTable.querySelector('thead tr');
        if (theadRow) {
          const headerCells = theadRow.querySelectorAll('th');
          headerCells.forEach(cell => {
            cell.textContent = '';
          });
        }

        // Then handle tbody rows
        const tbodyRows = mainTable.querySelectorAll('tbody tr');
        
        // Filter out empty rows from the data
        const validData = data.filter(member => member.name || member.classification);

        tbodyRows.forEach((row, index) => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 7) {
            console.warn(`Row ${index} does not have enough cells`);
            return;
          }

          const member = validData[index];
          
          try {
            // If we have data for this row, update it
            if (member && member.name) {
              // Only populate rows that have actual data
              cells[0].textContent = ''; // Leave the first column empty
              cells[1].textContent = member.name;
              cells[2].textContent = member.classification;
              cells[3].textContent = member.days[0]?.on || '';
              cells[4].textContent = member.days[0]?.off || '';
              cells[5].textContent = member.days[1]?.on || '';
              cells[6].textContent = member.days[1]?.off || '';
            } else {
              // Clear the row if no data
              cells.forEach(cell => {
                cell.textContent = '';
              });
            }
          } catch (err) {
            console.error(`Error updating row ${index}:`, err);
          }
        });
      }

      // Update remarks table
      const remarksTable = tempDiv.querySelector('.remarks-table');
      if (remarksTable) {
        const remarksTbody = remarksTable.querySelector('tbody');
        if (remarksTbody) {
          const remarks: string[] = [];
          
          // Calculate total hours using the existing function
          const totalHours = calculateTotalHours(data);
          const formattedTotalHours = totalHours.toFixed(2);

          // First content row (actually second row) will be HOTLINE/Travel + Total Hours
          const firstRowText = crewInfo.checkboxStates?.hotline ? 'HOTLINE' : 'Travel';
          const firstContentRow = `<tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;"><span style="display: inline-block; width: 6.5cm;">${firstRowText}</span>Total Hours: ${formattedTotalHours}</td></tr>`;
          
          // Add checkbox-based remarks
          if (crewInfo.checkboxStates?.noMealsLodging) remarks.push('Self Sufficient - No Meals Provided');
          if (crewInfo.checkboxStates?.noMeals) remarks.push('Self Sufficient - No Meals & No Lodging Provided');
          if (crewInfo.checkboxStates?.travel && crewInfo.checkboxStates?.hotline) remarks.push('Travel');
          if (crewInfo.checkboxStates?.noLunch) remarks.push('No Lunch Taken due to Uncontrolled Fire Line');

          // Add custom entries if they exist
          if (crewInfo.customEntries?.length) {
            remarks.push(...crewInfo.customEntries);
          }

          // Create rows for remaining remarks (up to 5 rows since first content row is used for status)
          const remarksHtml = remarks
            .slice(0, 5)
            .map(remark => `<tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;">${remark}</td></tr>`)
            .join('');

          // Fill remaining rows with empty cells if needed
          const emptyRowsNeeded = 5 - Math.min(remarks.length, 5);
          const emptyRows = Array(emptyRowsNeeded > 0 ? emptyRowsNeeded : 0)
            .fill('<tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;"></td></tr>')
            .join('');

          // Combine all rows with a blank first row
          remarksTbody.innerHTML = `<tr><td style="text-align: left; height: 0.435cm;"></td></tr>` + 
                                 firstContentRow + 
                                 remarksHtml + 
                                 emptyRows;
        }
      }

      // Add the content to the print container
      printContainer.innerHTML = tempDiv.innerHTML;

      // Store the original styles
      const originalStyles = {
        overflow: document.body.style.overflow,
      };

      // Hide scrollbars during printing
      document.body.style.overflow = 'hidden';

      // Print the document
      window.print();

      // Restore original styles
      document.body.style.overflow = originalStyles.overflow;

      // Clean up
      document.head.removeChild(styleElement);
      document.body.removeChild(printContainer);
    } catch (error) {
      console.error('Error updating template:', error);
      // Clean up on error
      if (document.head.contains(styleElement)) {
        document.head.removeChild(styleElement);
      }
      if (document.body.contains(printContainer)) {
        document.body.removeChild(printContainer);
      }
    }
  };

  return (
    <button onClick={handlePrint} className="ctr-btn print-btn">
      Print Table
    </button>
  );
};

export default PrintableTable; 