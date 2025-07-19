// microservice handler for the printable table for HTML printing
import React from 'react';
import { CrewMember, CrewInfo } from '../types/CTRTypes';
import { calculateTotalHours } from '../utils/timeCalculations';

// PrintableTableProps interface
interface PrintableTableProps {
  data: CrewMember[];
  crewInfo: CrewInfo;
  days: string[];
  onBeforePrint?: () => Promise<void> | void;
}

// format the date
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Convert from YYYY-MM-DD to YY-MM-DD
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[0].slice(2)}-${parts[1]}-${parts[2]}`;
  }
  return dateStr;
};

// Function to render the PrintableTable component
const PrintableTable: React.FC<PrintableTableProps> = ({ data, crewInfo, days, onBeforePrint }) => {
  const handlePrint = async () => {
    if (onBeforePrint) {
      await onBeforePrint();
    }
    // Open a new window with the print template
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // HTML template - DO NOT CHANGE THIS TEMPLATE
    const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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

        .back-btn {
            position: fixed;
            bottom: 8px;
            left: 8px;
            background: #07f;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            max-width: 80px;
        }

        .back-btn:hover {
            background: #056;
        }

        .print-btn {
            position: fixed;
            bottom: 8px;
            right: 8px;
            background: #28a745;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            max-width: 80px;
        }

        .print-btn:hover {
            background: #218838;
        }

        @media print {
            .back-btn, .print-btn {
                display: none !important;
            }
        }

        @media (max-width: 600px) {
            .back-btn {
                font-size: 14px;
                padding: 10px 16px;
                border-radius: 5px;
                bottom: 12px;
                left: 12px;
                max-width: 100px;
            }
            
            .print-btn {
                font-size: 14px;
                padding: 10px 16px;
                border-radius: 5px;
                bottom: 12px;
                right: 12px;
                max-width: 100px;
            }
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
    <!-- Back Button -->
    <button class="back-btn" onclick="window.close()">← Back</button>
    
    <!-- Print Button -->
    <button class="print-btn" onclick="window.print()">🖨️ Print</button>
    
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

    // Wait for the content to be parsed
    setTimeout(() => {
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

          // iterate through the tbody rows
          tbodyRows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            // if the row does not have enough cells, return
            if (cells.length < 7) {
              console.warn(`Row ${index} does not have enough cells`);
              return;
            }

            // get the member data
            const member = validData[index];

            try {
              // if we have data for this row, update it
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
            const firstContentRow = `<tr><td style="text-align: left; padding-left: 0.5cm; height: 0.435cm;"><span style="display: inline-block; margin-right: 5.5cm;">${firstRowText}</span>Total Hours: ${formattedTotalHours}</td></tr>`;
            
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

        // Write the modified content to the new window
        printWindow.document.write('<!DOCTYPE html>');
        printWindow.document.write(tempDiv.innerHTML);
        printWindow.document.close();
        
        // Ensure the buttons are visible by adding them again if needed
        setTimeout(() => {
          if (printWindow.document.body) {
            // Check if buttons exist, if not add them
            let backBtn = printWindow.document.querySelector('.back-btn') as HTMLButtonElement | null;
            let printBtn = printWindow.document.querySelector('.print-btn') as HTMLButtonElement | null;
            
            if (!backBtn) {
              backBtn = printWindow.document.createElement('button') as HTMLButtonElement;
              backBtn.className = 'back-btn';
              backBtn.onclick = () => printWindow.close();
              backBtn.textContent = '← Back';
              printWindow.document.body.appendChild(backBtn);
            }
            
            if (!printBtn) {
              printBtn = printWindow.document.createElement('button') as HTMLButtonElement;
              printBtn.className = 'print-btn';
              printBtn.onclick = () => printWindow.print();
              printBtn.textContent = '🖨️ Print';
              printWindow.document.body.appendChild(printBtn);
            }
          }
        }, 200);

        // Print the window after ensuring content is loaded
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            // Close the window after printing (optional)
            // printWindow.close();
          }, 500);
        };
      } catch (error) {
        console.error('Error updating template:', error);
        printWindow.close();
      }
    }, 100); // Small delay to ensure DOM is parsed
  };

  return (
    <button onClick={handlePrint} className="ctr-btn print-btn">
      Send to Printer
    </button>
  );
};

export default PrintableTable; 