// file for filling the CTR PDF
// Type declaration for the import meta
declare global {
  interface ImportMeta {
    env: {
      BASE_URL: string;
      MODE: string;
      DEV: boolean;
      PROD: boolean;
    }
  }
}

// imports for the fillCTRPDF function
import { PDFDocument } from 'pdf-lib';
import { mapToPDFFields } from './pdfFieldMapper';
import { generateExportFilename } from './filenameGenerator';
import { storePDF } from './pdfStorage';

// initialize object for PDF generation options
interface PDFGenerationOptions {
  downloadImmediately?: boolean;
  returnBlob?: boolean;
}

// Fills the CTR PDF and either triggers a download or returns the PDF data
export async function fillCTRPDF(
  data: any[], 
  crewInfo: any, 
  options: PDFGenerationOptions = { downloadImmediately: true },
  pdfUrl = '/CTR_Fillable_Edited.pdf'
) {
  // Debug: Log platform and browser information
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  const isChrome = /Chrome/.test(navigator.userAgent);
  const isChromeIOS = isIOS && isChrome;
  const isSafariIOS = isIOS && isSafari;
  
  console.log('🔍 fillCTRPDF: Platform Info:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    isIOS,
    isSafari,
    isChrome,
    isChromeIOS,
    isSafariIOS,
    isFirefox: /Firefox/.test(navigator.userAgent),
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    devicePixelRatio: window.devicePixelRatio
  });

  // Platform-specific handling for iOS (all browsers)
  if (isIOS) {
    console.log('🔍 fillCTRPDF: iOS device detected - applying iOS-specific handling');
    
    if (isChromeIOS) {
      console.log('🔍 fillCTRPDF: Chrome on iOS detected - applying Chrome iOS specific handling');
    }
    
    if (isSafariIOS) {
      console.log('🔍 fillCTRPDF: Safari on iOS detected - applying Safari iOS specific handling');
    }
    
    console.log('🔍 fillCTRPDF: iOS WebKit engine detected - PDF processing may differ from desktop');
  }

  try {
    // Ensure the PDF URL is absolute and includes base path
    const basePath = import.meta.env.BASE_URL || '/';
    const absolutePdfUrl = pdfUrl.startsWith('http') ? pdfUrl : `${basePath}${pdfUrl.startsWith('/') ? pdfUrl.slice(1) : pdfUrl}`;
    
    // Add cache-busting query parameter and force network fetch
    const urlWithCacheBust = `${absolutePdfUrl}?t=${Date.now()}`;
    
    const response = await fetch(urlWithCacheBust, {
      cache: 'no-store', // Force network fetch
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      console.error('PDF fetch failed:', response.status, response.statusText);
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const pdfBytes = await response.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const form = pdfDoc.getForm();
    const fields = mapToPDFFields(data, crewInfo);

    // Debug: Log available form fields
    console.log('Available PDF form fields:', form.getFields().map(f => f.getName()));

    // Debug: Inspect field properties for classification fields
    form.getFields().forEach(field => {
      if (field.getName().includes('CATION')) {
        console.log('Classification field properties:', {
          name: field.getName(),
          type: field.constructor.name,
          // Try to access maxLength property if it exists
          maxLength: (field as any).maxLength,
          charLimit: (field as any).charLimit,
          textLength: (field as any).textLength
        });
      }
    });

    // Debug: Check for classification field name variations
    const classificationFields = form.getFields().filter(field => 
      field.getName().includes('CATION') || 
      field.getName().includes('CLASS') ||
      field.getName().includes('ASS')
    );
    console.log('All classification-related fields:', classificationFields.map(f => f.getName()));

    // Fill fields
    Object.entries(fields).forEach(([field, value]) => {
      try {
        console.log(`🔍 fillCTRPDF: Attempting to fill field: ${field} with value: "${value}" (length: ${value.length})`);
        
        // For classification fields, add extra debugging
        if (field.includes('CATION')) {
          console.log(`🔍 fillCTRPDF: Classification field ${field}: original value "${value}" (length: ${value.length})`);
        }
        
        const textField = form.getTextField(field);
        
        // Check if the field has any length constraints
        const fieldProps = {
          name: field,
          type: textField.constructor.name,
          maxLength: (textField as any).maxLength,
          charLimit: (textField as any).charLimit,
          textLength: (textField as any).textLength
        };
        console.log(`🔍 fillCTRPDF: Field properties for ${field}:`, fieldProps);
        
        // iOS WebKit specific handling for classification fields
        if (isIOS && field.includes('CATION')) {
          console.log(`🔍 fillCTRPDF: iOS WebKit - special handling for classification field ${field}`);
          
          // Try setting the field multiple times to ensure it sticks
          textField.setText(value);
          
          // Verify the value was set correctly
          let actualValue = textField.getText();
          let attempts = 0;
          const maxAttempts = 3;
          
          while (actualValue !== value && attempts < maxAttempts) {
            console.log(`🔍 fillCTRPDF: iOS WebKit - attempt ${attempts + 1}: field ${field} value mismatch, retrying...`);
            textField.setText(value);
            actualValue = textField.getText();
            attempts++;
          }
          
          if (actualValue !== value) {
            console.warn(`🔍 fillCTRPDF: iOS WebKit - failed to set field ${field} after ${maxAttempts} attempts`);
          }
        } else {
          textField.setText(value);
        }
        
        // Check what was actually set
        const actualValue = textField.getText();
        console.log(`🔍 fillCTRPDF: Field ${field}: set "${value}", actual value "${actualValue}"`);
        
        if (value !== actualValue) {
          console.warn(`🔍 fillCTRPDF: WARNING - Field ${field}: Value was truncated from "${value}" to "${actualValue}"`);
        }
      } catch (e) {
        // Field might not exist, try alternative field names for classification fields
        if (field.includes('CATION')) {
          console.log(`Field ${field} not found, trying alternative field names...`);
          
          const rowNum = field.match(/Row(\d+)/)?.[1];
          if (rowNum) {
            const alternativeFields = [
              `CtASSIF CATIONRow${rowNum}`,
              `CLASSIFICATIONRow${rowNum}`,
              `CLASSRow${rowNum}`,
              `CATIONRow${rowNum}`
            ];
            
            for (const altField of alternativeFields) {
              try {
                console.log(`Trying alternative field: ${altField}`);
                const textField = form.getTextField(altField);
                textField.setText(value);
                console.log(`Successfully filled alternative field ${altField} with "${value}"`);
                break;
              } catch (altError) {
                console.log(`Alternative field ${altField} also not found`);
              }
            }
          }
        } else {
          // Field might not exist, skip or log
          console.warn(`Field ${field} not found in PDF:`, e);
        }
      }
    });

    // Save PDF
    const filledPdfBytes = await pdfDoc.save();
    const blob = new Blob([filledPdfBytes], { type: 'application/pdf' });
    
    // Debug: Check the final PDF content after generation
    console.log('🔍 fillCTRPDF: Final PDF generated, size:', filledPdfBytes.length, 'bytes');
    
    // iOS WebKit specific verification
    if (isIOS) {
      console.log('🔍 fillCTRPDF: iOS WebKit - performing additional verification of PDF content');
      
      try {
        // Load the PDF back and verify all classification fields
        const verificationPdfDoc = await PDFDocument.load(filledPdfBytes);
        const verificationForm = verificationPdfDoc.getForm();
        const verificationFields = verificationForm.getFields();
        
        let verificationPassed = true;
        verificationFields.forEach(field => {
          if (field.getName().includes('CATION')) {
            const textField = verificationForm.getTextField(field.getName());
            const fieldValue = textField.getText();
            console.log(`🔍 fillCTRPDF: iOS WebKit verification - ${field.getName()} = "${fieldValue || ''}" (length: ${fieldValue?.length || 0})`);
            
            // Check if this field should have data (first two rows)
            const rowNum = field.getName().match(/Row(\d+)/)?.[1];
            if (rowNum && (rowNum === '1' || rowNum === '2')) {
              const expectedData = data[parseInt(rowNum) - 1]?.classification;
              if (expectedData && fieldValue !== expectedData) {
                console.warn(`🔍 fillCTRPDF: iOS WebKit verification FAILED - ${field.getName()} expected "${expectedData}" but got "${fieldValue}"`);
                verificationPassed = false;
              }
            }
          }
        });
        
        if (verificationPassed) {
          console.log('🔍 fillCTRPDF: iOS WebKit verification PASSED');
        } else {
          console.warn('🔍 fillCTRPDF: iOS WebKit verification FAILED - some fields have incorrect values');
        }
      } catch (e) {
        console.log('🔍 fillCTRPDF: iOS WebKit verification error:', e);
      }
    }
    
    // Debug: Memory and performance info
    if ('memory' in performance) {
      console.log('🔍 fillCTRPDF: Memory usage:', {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
      });
    }
    
    // Debug: Verify the final PDF content by loading it back and checking fields
    try {
      const verificationPdfDoc = await PDFDocument.load(filledPdfBytes);
      const verificationForm = verificationPdfDoc.getForm();
      const verificationFields = verificationForm.getFields();
      
      console.log('🔍 fillCTRPDF: Verification - PDF form fields after generation:', verificationFields.map(f => f.getName()));
      
      // Check classification fields in the final PDF
      verificationFields.forEach(field => {
        if (field.getName().includes('CATION')) {
          const textField = verificationForm.getTextField(field.getName());
          const fieldValue = textField.getText();
          console.log(`🔍 fillCTRPDF: Verification - Classification field ${field.getName()} = "${fieldValue || ''}" (length: ${fieldValue?.length || 0})`);
        }
      });
    } catch (e) {
      console.log('🔍 fillCTRPDF: Error verifying final PDF content:', e);
    }

    // Generate filename
    const filename = generateExportFilename({
      date: data[0]?.days[0]?.date || new Date().toISOString().split('T')[0],
      crewNumber: crewInfo.crewNumber || '',
      fireName: crewInfo.fireName || '',
      fireNumber: crewInfo.fireNumber || '',
      type: 'PDF'
    });

    // Store in IndexedDB
    const pdfId = await storePDF(blob, null, {
      filename,
      date: data[0]?.days[0]?.date || new Date().toISOString().split('T')[0],
      crewNumber: crewInfo.crewNumber || '',
      fireName: crewInfo.fireName || '',
      fireNumber: crewInfo.fireNumber || ''
    });

    // Handle different output modes
    if (options.downloadImmediately) {
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    // Return data based on options
    if (options.returnBlob) {
      return { blob, filename, pdfId };
    }
    
    return { filename, pdfId };
  } catch (error) {
    console.error('Error filling PDF:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to generate PDF. Please check your internet connection and try again.');
  }
} 