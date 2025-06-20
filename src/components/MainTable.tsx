import React, { useEffect, useState } from 'react';
import { defaultData } from '../data/defaultData';
import '../styles/MainTable.css';
import { fillCTRPDF } from '../utils/fillCTRPDF';
import { fillExcelTemplate } from '../utils/fillExcelTemplate';
import { generateExportFilename } from '../utils/filenameGenerator';
import { ctrDataService } from '../utils/CTRDataService';
import { Notification } from './Notification';
import { mapExcelToData } from '../utils/excelMapping';
import { CrewMember, CrewInfo, Day } from '../types/CTRTypes';
import { calculateTotalHours } from '../utils/timeCalculations';
import { DateCalendar } from './DateCalendar';
import PDFGenerationViewer from './PDFGenerationViewer';
import EnhancedPDFViewer from './EnhancedPDFViewer';
import { storePDF, listPDFs } from '../utils/pdfStorage';
import ExcelJS from 'exceljs';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import type { Workbook } from 'xlsx-populate';
import XLSX from 'xlsx';
import PrintableTable from './PrintableTable';
import '../styles/components/PrintableTable.css';

// TypeScript interfaces
interface EditingCell {
  row: number;
  field: string;
  dayIdx?: number;
}

interface NotificationState {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  show: boolean;
}

interface PDFData {
  id: string;
  pdf: Blob;
  preview: Blob | null;
  metadata: {
    filename: string;
    date: string;
    crewNumber: string;
    fireName: string;
    fireNumber: string;
  };
  timestamp: string;
}

interface CheckboxStates {
  noMealsLodging: boolean;
  noMeals: boolean;
  travel: boolean;
  noLunch: boolean;
  hotline: boolean;
}

const defaultCheckboxStates: CheckboxStates = {
  noMealsLodging: false,
  noMeals: false,
  travel: false,
  noLunch: false,
  hotline: true
};

const STORAGE_KEY = 'ctr-table-data';

function saveData(data: CrewMember[]) {
  // No longer needed since we're using IndexedDB
}

function loadData(): CrewMember[] {
  // No longer needed since we're using IndexedDB
  return defaultData;
}

// Add deep comparison utility
function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

const MainTable: React.FC = () => {
  const [data, setData] = useState<CrewMember[]>(defaultData);
  
  const [dayCount, setDayCount] = useState(2);
  
  const [days, setDays] = useState<string[]>(['', '']);
  const [showSaveDefault, setShowSaveDefault] = useState(false);
  const [crewInfo, setCrewInfo] = useState<CrewInfo>({
    crewName: '',
    crewNumber: '',
    fireName: '',
    fireNumber: ''
  });
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [notification, setNotification] = useState<NotificationState>({
    message: '',
    type: 'info',
    show: false
  });

  // Add state to track last saved version
  const [lastSavedState, setLastSavedState] = useState({
    data: data,
    crewInfo: crewInfo,
    days: days
  });

  const [currentDateIndex, setCurrentDateIndex] = useState<number>(-1);

  // Calculate total hours whenever data changes
  const totalHours = calculateTotalHours(data);

  // Add state to track last saved version
  const [lastSavedTotalHours, setLastSavedTotalHours] = useState(0);

  // Add state to track last saved crew info
  const [lastSavedCrewInfo, setLastSavedCrewInfo] = useState<CrewInfo>({
    crewName: '',
    crewNumber: '',
    fireName: '',
    fireNumber: ''
  });

  const [showCalendar, setShowCalendar] = useState(false);
  const [showCustomDatePicker, setShowCustomDatePicker] = useState<number | null>(null);

  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [pdfId, setPdfId] = useState<string | null>(null);

  // Add a new state to track PDFs for specific date ranges
  const [pdfsByDateRange, setPdfsByDateRange] = useState<Record<string, string>>({});

  // Add state for tracking if we're in signing mode
  const [isSigningMode, setIsSigningMode] = useState(false);

  // Add state for collapsible section
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [checkboxStates, setCheckboxStates] = useState<CheckboxStates>(defaultCheckboxStates);
  const [customEntries, setCustomEntries] = useState<string[]>([]);
  const [newEntry, setNewEntry] = useState('');

  const handleCheckboxChange = (option: keyof typeof checkboxStates) => {
    setCheckboxStates(prev => {
      const newStates = { ...prev };
      
      if (option === 'travel') {
        // If turning on travel, automatically uncheck hotline
        if (!prev.travel) {
          newStates.hotline = false;
        }
        newStates.travel = !prev.travel;
      } else if (option === 'hotline') {
        newStates.hotline = !prev.hotline;
      } else {
        newStates[option] = !prev[option];
      }
      
      return newStates;
    });
  };

  const handleAddEntry = () => {
    if (newEntry.trim() && !customEntries.includes(newEntry.trim())) {
      setCustomEntries(prev => [...prev, newEntry.trim()]);
      setNewEntry('');
    }
  };

  const handleRemoveCustomEntry = (entryToRemove: string) => {
    setCustomEntries(prev => prev.filter(entry => entry !== entryToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddEntry();
    }
  };

  // Load saved dates on component mount
  useEffect(() => {
    const initializeApp = async () => {
      await loadSavedDates();
      // Load the first available date range if any exist
      const dateRanges = await ctrDataService.getAllDateRanges();
      
      // Load PDFs for all date ranges
      const pdfs = await listPDFs();
      const pdfMapping: Record<string, string> = {};
      pdfs.forEach((pdf: PDFData) => {
        const { date, crewNumber, fireName, fireNumber } = pdf.metadata;
        // Find the date range that matches this PDF's metadata
        const matchingDateRange = dateRanges.find(range => {
          const [rangeDate] = range.split(' to ');
          return rangeDate === date && 
                 pdf.metadata.crewNumber === crewNumber &&
                 pdf.metadata.fireName === fireName &&
                 pdf.metadata.fireNumber === fireNumber;
        });
        if (matchingDateRange) {
          pdfMapping[matchingDateRange] = pdf.id;
        }
      });
      setPdfsByDateRange(pdfMapping);
      
      if (dateRanges.length > 0) {
        const firstDateRange = dateRanges[0];
        await handleDateSelect(firstDateRange);
      }
    };
    initializeApp();
  }, []);

  // Update lastSavedState when data is loaded
  useEffect(() => {
    // Only update lastSavedState if we have actual data (not just the initial state)
    if (data !== defaultData) {
      setLastSavedState({
        data: [...data],
        crewInfo: { 
          ...crewInfo,
          checkboxStates: { ...checkboxStates },
          customEntries: [...customEntries]
        },
        days: [...days]
      });
    }
  }, [data, crewInfo, days, checkboxStates, customEntries]);

  // Update lastSavedTotalHours when data is loaded
  useEffect(() => {
    // Only update lastSavedTotalHours if we have actual data (not just the initial state)
    if (data !== defaultData) {
      setLastSavedTotalHours(totalHours);
    }
  }, [data, totalHours]);

  // Replace the existing useEffect for change tracking
  useEffect(() => {
    // Check if we have all required crew info
    const hasCrewInfo = Boolean(
      crewInfo.crewName && 
      crewInfo.crewNumber && 
      crewInfo.fireName && 
      crewInfo.fireNumber
    );

    // Check if we have both dates
    const hasDates = Boolean(days[0] && days[1]);

    // Check if total hours have changed
    const hoursChanged = Math.abs(totalHours - lastSavedTotalHours) > 0.01;

    // Check if crew info has changed
    const crewInfoChanged = Boolean(
      crewInfo.crewName !== lastSavedCrewInfo.crewName ||
      crewInfo.crewNumber !== lastSavedCrewInfo.crewNumber ||
      crewInfo.fireName !== lastSavedCrewInfo.fireName ||
      crewInfo.fireNumber !== lastSavedCrewInfo.fireNumber
    );

    // Check if checkbox states have changed
    const checkboxStatesChanged = !deepEqual(
      checkboxStates,
      lastSavedState.crewInfo.checkboxStates || {
        noMealsLodging: false,
        noMeals: false,
        travel: false,
        noLunch: false
      }
    );

    // Check if custom entries have changed
    const customEntriesChanged = !deepEqual(
      customEntries,
      lastSavedState.crewInfo.customEntries || []
    );

    // Only set hasUnsavedChanges if we have required fields and any changes
    const hasChanges = Boolean(
      (hoursChanged || crewInfoChanged || checkboxStatesChanged || customEntriesChanged) && 
      hasCrewInfo && 
      hasDates
    );

    setHasUnsavedChanges(hasChanges);
  }, [totalHours, crewInfo, days, lastSavedTotalHours, lastSavedCrewInfo, checkboxStates, customEntries, lastSavedState]);

  const loadSavedDates = async () => {
    try {
      const dateRanges = await ctrDataService.getAllDateRanges();
      setSavedDates(dateRanges);
    } catch (error) {
      console.error('Error loading saved dates:', error);
    }
  };

  const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error') => {
    setNotification({ message, type, show: true });
  };

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  const handleSave = async () => {
    if (!days[0] || !days[1]) {
      showNotification('Please select both dates before saving.', 'warning');
      return;
    }
    try {
      const date1 = days[0];
      const date2 = days[1];
      await ctrDataService.saveRecord(date1, date2, data, {
        ...crewInfo,
        checkboxStates,
        customEntries
      });
      await loadSavedDates();
      
      setLastSavedTotalHours(totalHours);
      setLastSavedCrewInfo({ ...crewInfo });
      
      setHasUnsavedChanges(false);
      showNotification('Data saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving data:', error);
      showNotification('Failed to save data. Please try again.', 'error');
    }
  };

  const findCurrentDateIndex = () => {
    if (!selectedDate) return -1;
    return savedDates.findIndex(date => date === selectedDate);
  };

  const handlePreviousEntry = async () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Do you want to continue without saving?');
      if (!confirm) return;
    }
    
    const currentIndex = findCurrentDateIndex();
    if (currentIndex > 0) {
      const prevDateRange = savedDates[currentIndex - 1];
      await handleDateSelect(prevDateRange);
    }
  };

  const handleNextEntry = async () => {
    if (hasUnsavedChanges) {
      const confirm = window.confirm('You have unsaved changes. Do you want to continue without saving?');
      if (!confirm) return;
    }
    
    const currentIndex = findCurrentDateIndex();
    if (currentIndex < savedDates.length - 1) {
      const nextDateRange = savedDates[currentIndex + 1];
      await handleDateSelect(nextDateRange);
    }
  };

  const handleDateSelect = async (dateRange: string) => {
    if (!dateRange || dateRange === "") {
      // If no date range is selected, reset to new entry state
      setData(defaultData);
      setCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setDays(['', '']);
      setSelectedDate('');
      setCurrentDateIndex(-1);
      setHasUnsavedChanges(false);
      setLastSavedTotalHours(0);
      setLastSavedCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setCheckboxStates(defaultCheckboxStates);
      setCustomEntries([]);
      setPdfId(null);
      return;
    }

    if (dateRange === "new") {
      if (hasUnsavedChanges) {
        showNotification('You have unsaved changes. Please save or discard them before starting a new entry.', 'warning');
        return;
      }
      setData(defaultData);
      setCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setDays(['', '']);
      setSelectedDate('');
      setCurrentDateIndex(-1);
      setHasUnsavedChanges(false);
      setLastSavedTotalHours(0);
      setLastSavedCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setCheckboxStates(defaultCheckboxStates);
      setCustomEntries([]);
      setPdfId(null);
      showNotification('New entry started', 'info');
      return;
    }

    if (hasUnsavedChanges) {
      showNotification('You have unsaved changes. Please save or discard them before loading another date range.', 'warning');
      return;
    }

    try {
      const [date1, date2] = dateRange.split(' to ');
      const record = await ctrDataService.getRecord(dateRange);
      if (record) {
        setData(record.data);
        const { checkboxStates: savedCheckboxStates = defaultCheckboxStates, customEntries = [], ...savedCrewInfo } = record.crewInfo;
        setCrewInfo(savedCrewInfo);
        setCheckboxStates({
          ...defaultCheckboxStates,
          ...savedCheckboxStates
        });
        setCustomEntries(customEntries);
        setDays([date1, date2]);
        setSelectedDate(dateRange);
        // Update currentDateIndex based on the selected date range
        const newIndex = savedDates.findIndex(date => date === dateRange);
        setCurrentDateIndex(newIndex);
        setHasUnsavedChanges(false);
        
        // Set the PDF ID from the mapping, or null if no PDF exists for this date range
        setPdfId(pdfsByDateRange[dateRange] || null);
      }
    } catch (error) {
      console.error('Error loading record:', error);
      showNotification('Failed to load record', 'error');
    }
  };

  const handleCellDoubleClick = (rowIdx: number, field: string, dayIdx?: number) => {
    // Prevent re-entering edit mode if already editing
    if (editingCell?.row === rowIdx && editingCell?.field === field && editingCell?.dayIdx === dayIdx) {
      return;
    }
    setEditingCell({ row: rowIdx, field, dayIdx });
  };

  const validateMilitaryTime = (value: string): boolean => {
    if (!value) return true;
    
    // Must be exactly 4 digits
    if (value.length > 4) return false;
    
    // Convert to array of digits
    const digits = value.split('').map(Number);
    
    // First digit must be 0-2
    if (digits[0] > 2) return false;
    
    // Second digit rules based on first digit
    if (digits[0] === 2 && digits[1] > 3) return false;
    
    // Third digit must be 0-5
    if (digits[2] > 5) return false;
    
    return true;
  };

  const copyFFTTimes = () => {
    // Find the first FFT1 or FFT2 entry
    const fftIndex = data.findIndex(member => 
      member.classification?.toUpperCase().includes('FFT1') || 
      member.classification?.toUpperCase().includes('FFT2')
    );

    if (fftIndex === -1) {
      alert('Please enter an FFT1 or FFT2 classification first.');
      return;
    }

    if (!data[fftIndex].name) {
      alert('Please enter the FFT name first.');
      return;
    }

    const fftTimes = data[fftIndex].days;
    const newData = data.map((member, index) => {
      if (index <= fftIndex) return member; // Skip crew boss and FFT
      return {
        ...member,
        days: fftTimes.map(day => ({ ...day }))
      };
    });

    setData(newData);
    setHasUnsavedChanges(true);
  };

  const handleCellEdit = (e: React.ChangeEvent<HTMLInputElement>, rowIdx: number, field: string, dayIdx?: number) => {
    const { value } = e.target;
    
    // Validate military time for on/off fields
    if ((field === 'on' || field === 'off')) {
      // Only allow digits
      if (!/^\d*$/.test(value)) return;
      
      // Apply validation rules
      if (!validateMilitaryTime(value)) return;
    }

    const newData = [...data];
    
    // Ensure the row exists and has the required structure
    if (!newData[rowIdx]) {
      newData[rowIdx] = {
        name: '',
        classification: '',
        days: days.map(date => ({ date, on: '', off: '' }))
      };
    }
    
    // Ensure days array exists
    if (!newData[rowIdx].days) {
      newData[rowIdx].days = days.map(date => ({ date, on: '', off: '' }));
    }
    
    if (dayIdx !== undefined) {
      // Ensure the day object exists
      if (!newData[rowIdx].days[dayIdx]) {
        newData[rowIdx].days[dayIdx] = { date: days[dayIdx] || '', on: '', off: '' };
      }
      newData[rowIdx].days[dayIdx][field as keyof Day] = value;

      // If this is the second row (index 1) and we're editing ON/OFF times
      if (rowIdx === 1) {
        // Copy these times to all subsequent rows that have names
        for (let i = 2; i < newData.length; i++) {
          if (newData[i]?.name) {
            if (!newData[i].days[dayIdx]) {
              newData[i].days[dayIdx] = { date: days[dayIdx] || '', on: '', off: '' };
            }
            newData[i].days[dayIdx][field as keyof Day] = value;
          }
        }
      }
    } else {
      (newData[rowIdx] as any)[field] = value;

      // If this is a name field and it's not the first FFT1/FFT2, copy their times
      if (field === 'name' && value) {
        const fftIndex = newData.findIndex(member => 
          member?.classification?.toUpperCase().includes('FFT1') || 
          member?.classification?.toUpperCase().includes('FFT2')
        );

        if (fftIndex !== -1 && rowIdx > fftIndex && newData[fftIndex]?.days) {
          const fftTimes = newData[fftIndex].days;
          newData[rowIdx].days = fftTimes.map(day => ({ ...day }));
        }
      }
    }
    
    setData(newData);
    setHasUnsavedChanges(true);
  };

  const handleCellBlur = (e: React.FocusEvent) => {
    // On mobile, only blur if the related target is not another input
    // This prevents the cell from exiting edit mode when the keyboard appears
    if (isTouchDevice && e.relatedTarget instanceof HTMLInputElement) {
      return;
    }
    
    // Use requestAnimationFrame to ensure this runs after any click handlers
    requestAnimationFrame(() => {
      setEditingCell(null);
    });
  };

  const handleDelete = (idx: number) => {
    const newData = data.filter((_, i) => i !== idx);
    setData(newData);
  };

  const handleHeaderDateChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const newDate = e.target.value;
    setDays(prev => prev.map((d, i) => (i === idx ? newDate : d)));
    setData(data => data.map(row => ({
      ...row,
      days: row.days.map((day, i) => i === idx ? { ...day, date: newDate } : day)
    })));
    setHasUnsavedChanges(true);
  };

  const handleResetToDefault = () => {
    setData(defaultData);
    setShowSaveDefault(false);
    showNotification('Restored to original default data!', 'info');
  };

  const handleSaveDefault = () => {
    setShowSaveDefault(false);
    showNotification('Current table saved as default!', 'success');
  };

  const handleExportExcel = async () => {
    try {
      if (!data || data.length === 0) {
        showNotification('No data to export', 'warning');
        return;
      }

      showNotification('Generating Excel...', 'info');
      
      const workbook = await fillExcelTemplate(
        data,
        crewInfo,
        days
      );

      // Convert workbook to buffer
      const buffer = await workbook.xlsx.writeBuffer();

      // Create blob and download
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = generateExportFilename({
        date: days[0],
        crewNumber: crewInfo.crewNumber,
        fireName: crewInfo.fireName,
        fireNumber: crewInfo.fireNumber,
        type: 'Excel'
      });
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showNotification('Excel file generated successfully!', 'success');
    } catch (error) {
      console.error('Error generating Excel:', error);
      let errorMessage = 'Failed to generate Excel file. ';
      
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage += 'Please check your internet connection and try again.';
        } else if (error.message.includes('template')) {
          errorMessage += 'The Excel template could not be loaded. Please try refreshing the page.';
        } else {
          errorMessage += 'An unexpected error occurred. Please try again.';
        }
      }
      
      showNotification(errorMessage, 'error');
    }
  };

  const handleExportPDF = async () => {
    try {
      // Generate PDF without immediate download
      const result = await fillCTRPDF(data, {
        ...crewInfo,
        checkboxStates,
        customEntries
      }, { 
        downloadImmediately: false,
        returnBlob: false
      });

      // Store the PDF ID for the current date range
      const currentDateRange = `${days[0]} to ${days[1]}`;
      setPdfsByDateRange(prev => ({
        ...prev,
        [currentDateRange]: result.pdfId
      }));
      setPdfId(result.pdfId);
      showNotification('PDF generated successfully. Click below to view and sign.', 'success');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      showNotification('Failed to export PDF. Please try again.', 'error');
    }
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) return;

        // Create a new workbook and load the uploaded file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data as ArrayBuffer);
        
        // Try different ways to get the worksheet
        let worksheet = workbook.getWorksheet(1); // Try index 1 first
        if (!worksheet) {
          worksheet = workbook.getWorksheet('Sheet1'); // Try 'Sheet1' name
        }
        if (!worksheet) {
          worksheet = workbook.worksheets[0]; // Try first worksheet
        }
        if (!worksheet) {
          console.error('Available worksheets:', workbook.worksheets.map(ws => ({ name: ws.name, id: ws.id })));
          throw new Error('No worksheet found in the uploaded Excel file');
        }

        console.log('Found worksheet:', {
          name: worksheet.name,
          id: worksheet.id,
          rowCount: worksheet.rowCount,
          columnCount: worksheet.columnCount
        });
        
        // Use the mapping utility to extract data
        const { crewInfo: importedCrewInfo, crewMembers } = mapExcelToData(worksheet);
        
        // Update the application state
        setCrewInfo(importedCrewInfo);
        setData(crewMembers);
        
        // Extract dates from the first crew member's days
        if (crewMembers.length > 0 && crewMembers[0].days) {
          const dates = crewMembers[0].days.map(d => d.date || '');
          setDays(dates);
          setDayCount(dates.length);
        }
        
        setShowSaveDefault(true);
        showNotification('Excel file imported successfully', 'success');
      } catch (error) {
        console.error('Error importing Excel file:', error);
        showNotification('Error importing Excel file. Please check the file format and try again.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCopyToNextDay = async () => {
    if (!days[0] || !days[1]) {
      showNotification('Please set both dates before copying to next days.', 'warning');
      return;
    }

    // Validate that we have crew data
    const hasCrewData = data.some(member => 
      member.name && member.classification
    );

    if (!hasCrewData) {
      showNotification('Please enter crew information before copying to next days.', 'warning');
      return;
    }

    try {
      showNotification('Copying data to next 20 days...', 'info');
      
      // Get the base dates
      const startDate = new Date(days[0]);
      const endDate = new Date(days[1]);
      const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Copy data for next 20 days
      for (let i = 0; i < 20; i++) {
        // Calculate new date range starting from the day after date2
        const newStartDate = new Date(endDate);
        newStartDate.setDate(newStartDate.getDate() + 1 + (i * (daysDiff + 1)));
        
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + daysDiff);

        const newStartDateStr = newStartDate.toISOString().split('T')[0];
        const newEndDateStr = newEndDate.toISOString().split('T')[0];

        // Create new data with updated dates but empty time entries
        const newData = data.map(member => ({
          name: member.name,
          classification: member.classification,
          days: [
            { date: newStartDateStr, on: '', off: '' },
            { date: newEndDateStr, on: '', off: '' }
          ]
        }));

        // Save the new date range
        await ctrDataService.saveRecord(newStartDateStr, newEndDateStr, newData, crewInfo);
      }

      // Reload saved dates
      await loadSavedDates();
      setCurrentDateIndex(findCurrentDateIndex());
      showNotification('Successfully copied crew information to next 20 days!', 'success');
    } catch (error) {
      console.error('Error copying data to next days:', error);
      showNotification('Failed to copy data to next days. Please try again.', 'error');
    }
  };

  const handleRemoveEntry = async () => {
    if (!selectedDate) {
      showNotification('Please select a date range to remove.', 'warning');
      return;
    }

    if (hasUnsavedChanges) {
      showNotification('Please save or discard your changes before removing an entry.', 'warning');
      return;
    }

    try {
      await ctrDataService.deleteRecord(selectedDate);
      // Remove the PDF ID for this date range
      setPdfsByDateRange(prev => {
        const newPdfsByDateRange = { ...prev };
        delete newPdfsByDateRange[selectedDate];
        return newPdfsByDateRange;
      });
      await loadSavedDates();
      setSelectedDate('');
      setCurrentDateIndex(-1);
      setData(defaultData);
      setCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setDays(['', '']);
      setPdfId(null);
      showNotification('Entry removed successfully', 'success');
    } catch (error) {
      console.error('Error removing entry:', error);
      showNotification('Failed to remove entry. Please try again.', 'error');
    }
  };

  return (
    <div className="ctr-container">
      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
      <h1 className="ctr-title" aria-label="Crew Time Report Table">
        Crew Time Report Table
      </h1>
      
      {/* Date Selection and Save Controls */}
      <div className="ctr-date-controls">
        <div className="ctr-date-selector">
          <select 
            value={selectedDate}
            onChange={(e) => handleDateSelect(e.target.value)}
            className="ctr-select"
          >
            {savedDates.map(dateRange => {
              const [date1, date2] = dateRange.split(' to ');
              return (
                <option key={dateRange} value={dateRange}>
                  {date1} to {date2}
                </option>
              );
            })}
            <option value="new">+ New Entry</option>
          </select>
          <button 
            className="ctr-btn calendar-btn"
            onClick={() => setShowCalendar(true)}
            title="Open Calendar View"
          >
            📅
          </button>
        </div>
        <div className="ctr-navigation-buttons">
          <button 
            className="ctr-btn nav-btn" 
            onClick={handlePreviousEntry}
            disabled={currentDateIndex <= 0}
          >
            ← Previous
          </button>
          <button 
            className="ctr-btn nav-btn" 
            onClick={handleNextEntry}
            disabled={savedDates.length === 0 || currentDateIndex >= savedDates.length - 1}
          >
            Next →
          </button>
        </div>
        <button 
          className="ctr-btn copy-btn" 
          onClick={handleCopyToNextDay}
          disabled={!days[1]}
        >
          Copy to Next 20 Days
        </button>
        <button 
          className="ctr-btn save-btn" 
          onClick={handleSave}
          disabled={!hasUnsavedChanges || !days[0] || !days[1]}
        >
          {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
        </button>
      </div>

      <div className="ctr-crew-info-form">
        <input
          className="ctr-input"
          placeholder="Crew Name"
          value={crewInfo.crewName}
          onChange={e => setCrewInfo({ ...crewInfo, crewName: e.target.value })}
        />
        <input
          className="ctr-input"
          placeholder="Crew Number"
          value={crewInfo.crewNumber}
          onChange={e => setCrewInfo({ ...crewInfo, crewNumber: e.target.value })}
        />
        <input
          className="ctr-input"
          placeholder="Fire Name"
          value={crewInfo.fireName}
          onChange={e => setCrewInfo({ ...crewInfo, fireName: e.target.value })}
        />
        <input
          className="ctr-input"
          placeholder="Fire Number"
          value={crewInfo.fireNumber}
          onChange={e => setCrewInfo({ ...crewInfo, fireNumber: e.target.value })}
        />
      </div>
      <div className="ctr-actions">
        <input type="file" accept=".xlsx" onChange={handleExcelUpload} />
        <button className="ctr-btn" onClick={handleExportExcel}>Export Excel</button>
        <button className="ctr-btn" onClick={handleExportPDF}>Save to PDF</button>
        <PrintableTable 
          data={data} 
          crewInfo={{
            ...crewInfo,
            checkboxStates,
            customEntries
          }} 
          days={days} 
        />
        {pdfId && (
          <button 
            className="ctr-btn sign-btn" 
            onClick={() => {
              setIsSigningMode(true);
              setShowPDFViewer(true);
            }}
            style={{ background: '#4caf50' }}
          >
            Sign PDF
          </button>
        )}
        {showSaveDefault && (
          <button className="ctr-btn" onClick={handleSaveDefault} style={{ background: '#388e3c' }}>Save as Default</button>
        )}
        <button className="ctr-btn" onClick={handleResetToDefault} style={{ background: '#888' }}>Reset to Default</button>
        <button 
          className="ctr-btn" 
          onClick={handleRemoveEntry}
          disabled={!selectedDate}
          style={{ background: '#d32f2f' }}
        >
          Remove Entry
        </button>
      </div>
      <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
        <table className="ctr-table">
          <thead>
            <tr>
              <th className="ctr-th name" rowSpan={2}>NAME</th>
              <th className="ctr-th class" rowSpan={2}>JOB TITLE</th>
              {days.map((date, i) => (
                <th className="ctr-th date" colSpan={2} key={i} style={{ textAlign: 'center' }}>
                  DATE<br />
                  <input
                    className="ctr-input ctr-date"
                    type="date"
                    value={date}
                    onChange={e => handleHeaderDateChange(e, i)}
                    style={{ fontWeight: 'bold', fontSize: 14, textAlign: 'center', background: 'transparent', border: 'none', borderBottom: '1.5px solid #d32f2f' }}
                  />
                </th>
              ))}
              <th className="ctr-th" rowSpan={2}></th>
            </tr>
            <tr>
              {days.map((_, i) => (
                <React.Fragment key={i}>
                  <th className="ctr-th">ON</th>
                  <th className="ctr-th">OFF</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 20 }).map((_, idx) => {
              const row = data[idx] || {
                name: '',
                classification: '',
                days: days.map(date => ({ date, on: '', off: '' }))
              };
              
              return (
                <tr key={idx} className="ctr-tr">
                  <td className="ctr-td name-col">
                    {editingCell?.row === idx && editingCell?.field === 'name' ? (
                      <input
                        className="ctr-input"
                        value={row.name || ''}
                        onChange={e => handleCellEdit(e, idx, 'name')}
                        onBlur={handleCellBlur}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="ctr-cell-content"
                        onDoubleClick={!isTouchDevice ? () => handleCellDoubleClick(idx, 'name') : undefined}
                        onClick={isTouchDevice ? (e) => {
                          e.preventDefault(); // Prevent any default touch behavior
                          e.stopPropagation(); // Stop event bubbling
                          handleCellDoubleClick(idx, 'name');
                        } : undefined}
                      >
                        {row.name
                          ? row.name
                              .split(/(?<=[a-z])(?=[A-Z])/)
                              .map((part, i) => (
                                <span key={i} style={{ display: 'block', wordBreak: 'break-word' }}>{part}</span>
                              ))
                          : ''}
                      </div>
                    )}
                  </td>
                  <td className="ctr-td class-col">
                    {editingCell?.row === idx && editingCell?.field === 'classification' ? (
                      <input
                        className="ctr-input"
                        value={row.classification}
                        onChange={e => handleCellEdit(e, idx, 'classification')}
                        onBlur={handleCellBlur}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="ctr-cell-content"
                        onDoubleClick={!isTouchDevice ? () => handleCellDoubleClick(idx, 'classification') : undefined}
                        onClick={isTouchDevice ? (e) => {
                          e.preventDefault(); // Prevent any default touch behavior
                          e.stopPropagation(); // Stop event bubbling
                          handleCellDoubleClick(idx, 'classification');
                        } : undefined}
                      >
                        {row.classification}
                      </div>
                    )}
                  </td>
                  {row.days.map((day, dayIdx) => (
                    <React.Fragment key={dayIdx}>
                      <td className="ctr-td time-col">
                        {editingCell?.row === idx && editingCell?.field === 'on' && editingCell?.dayIdx === dayIdx ? (
                          <input
                            className="ctr-input ctr-on"
                            value={day.on}
                            onChange={e => handleCellEdit(e, idx, 'on', dayIdx)}
                            onBlur={handleCellBlur}
                            autoFocus
                            placeholder="HHMM"
                            maxLength={4}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        ) : (
                          <div
                            className="ctr-cell-content"
                            onDoubleClick={!isTouchDevice ? () => handleCellDoubleClick(idx, 'on', dayIdx) : undefined}
                            onClick={isTouchDevice ? (e) => {
                              e.preventDefault(); // Prevent any default touch behavior
                              e.stopPropagation(); // Stop event bubbling
                              handleCellDoubleClick(idx, 'on', dayIdx);
                            } : undefined}
                          >
                            {day.on}
                          </div>
                        )}
                      </td>
                      <td className="ctr-td time-col">
                        {editingCell?.row === idx && editingCell?.field === 'off' && editingCell?.dayIdx === dayIdx ? (
                          <input
                            className="ctr-input ctr-off"
                            value={day.off}
                            onChange={e => handleCellEdit(e, idx, 'off', dayIdx)}
                            onBlur={handleCellBlur}
                            autoFocus
                            placeholder="HHMM"
                            maxLength={4}
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        ) : (
                          <div
                            className="ctr-cell-content"
                            onDoubleClick={!isTouchDevice ? () => handleCellDoubleClick(idx, 'off', dayIdx) : undefined}
                            onClick={isTouchDevice ? (e) => {
                              e.preventDefault(); // Prevent any default touch behavior
                              e.stopPropagation(); // Stop event bubbling
                              handleCellDoubleClick(idx, 'off', dayIdx);
                            } : undefined}
                          >
                            {day.off}
                          </div>
                        )}
                      </td>
                    </React.Fragment>
                  ))}
                  <td className="ctr-td">
                    {data[idx] && (
                      <button 
                        className="ctr-btn" 
                        style={{ background: '#d32f2f', padding: '2px 6px' }} 
                        onClick={() => handleDelete(idx)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total Hours Display */}
      <div className="ctr-total-hours">
        <div className="ctr-total-label">Total Hours Worked:</div>
        <div className="ctr-total-value">{totalHours.toFixed(2)}</div>
      </div>

      {/* Collapsible Section for Additional Options*/}
      <div className="collapsible-section">
        <button 
          className="collapse-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '▼' : '▲'} Additional Options
        </button>
        <div className={`collapse-content ${isCollapsed ? 'collapsed' : ''}`}>
          <div className="checkbox-options">
            {/* HOTLINE - interactive now */}
            <div className="checkbox-option">
              <input
                type="checkbox"
                checked={checkboxStates.hotline}
                onChange={() => handleCheckboxChange('hotline')}
                id="hotline-checkbox"
              />
              <label htmlFor="hotline-checkbox">HOTLINE</label>
            </div>

            {/* Regular interactive options */}
            <div className="checkbox-option">
              <input
                type="checkbox"
                checked={checkboxStates.noMealsLodging}
                onChange={() => handleCheckboxChange('noMealsLodging')}
                id="no-meals-lodging-checkbox"
              />
              <label htmlFor="no-meals-lodging-checkbox">Self Sufficient - No Meals Provided</label>
            </div>

            <div className="checkbox-option">
              <input
                type="checkbox"
                checked={checkboxStates.noMeals}
                onChange={() => handleCheckboxChange('noMeals')}
                id="no-meals-checkbox"
              />
              <label htmlFor="no-meals-checkbox">No Meals</label>
            </div>

            <div className="checkbox-option">
              <input
                type="checkbox"
                checked={checkboxStates.travel}
                onChange={() => handleCheckboxChange('travel')}
                id="travel-checkbox"
              />
              <label htmlFor="travel-checkbox">Travel</label>
            </div>

            <div className="checkbox-option">
              <input
                type="checkbox"
                checked={checkboxStates.noLunch}
                onChange={() => handleCheckboxChange('noLunch')}
                id="no-lunch-checkbox"
              />
              <label htmlFor="no-lunch-checkbox">No Lunch Taken due to Uncontrolled Fire</label>
            </div>

            {/* Custom entries */}
            {customEntries.map((entry, index) => (
              <div key={index} className="checkbox-option">
                <input
                  type="checkbox"
                  checked={true}
                  readOnly
                  id={`custom-entry-${index}`}
                />
                <label htmlFor={`custom-entry-${index}`}>{entry}</label>
                <button 
                  className="remove-entry"
                  onClick={() => handleRemoveCustomEntry(entry)}
                  aria-label="Remove entry"
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add new entry section */}
            <div className="add-entry-section">
              <input
                type="text"
                value={newEntry}
                onChange={(e) => setNewEntry(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add new option..."
                className="add-entry-input"
              />
              <button 
                className="add-entry-button"
                onClick={handleAddEntry}
                disabled={!newEntry.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCalendar && (
        <DateCalendar
          savedDates={savedDates}
          onDateSelect={handleDateSelect}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {showCustomDatePicker !== null && (
        <div className="custom-date-picker">
          <input
            type="date"
            value={days[showCustomDatePicker]}
            onChange={(e) => {
              const newDate = e.target.value;
              setDays(prev => prev.map((d, i) => (i === showCustomDatePicker ? newDate : d)));
              setData(data => data.map(row => ({
                ...row,
                days: row.days.map((day, i) => i === showCustomDatePicker ? { ...day, date: newDate } : day)
              })));
              setHasUnsavedChanges(true);
              setShowCustomDatePicker(null);
            }}
            onBlur={() => setShowCustomDatePicker(null)}
            autoFocus
          />
        </div>
      )}

      {showPDFViewer && pdfId && (
        <div className="modal">
          <div className="modal-content pdf-modal">
            <button 
              className="modal-close-btn"
              onClick={() => {
                setShowPDFViewer(false);
                setIsSigningMode(false);
              }}
            >
              ×
            </button>
            <EnhancedPDFViewer
              pdfId={pdfId}
              readOnly={false}
              crewInfo={{
                crewNumber: crewInfo.crewNumber,
                fireName: crewInfo.fireName,
                fireNumber: crewInfo.fireNumber
              }}
              date={days[0]}
              onSave={async (blob) => {
                try {
                  // Store the annotated version with the same ID to overwrite the original
                  const currentDateRange = `${days[0]} to ${days[1]}`;
                  const newPdfId = await storePDF(blob, null, {  // Pass null as pngPreview
                    filename: generateExportFilename({
                      date: days[0],
                      crewNumber: crewInfo.crewNumber,
                      fireName: crewInfo.fireName,
                      fireNumber: crewInfo.fireNumber,
                      type: 'PDF'
                    }),
                    date: days[0],
                    crewNumber: crewInfo.crewNumber,
                    fireName: crewInfo.fireName,
                    fireNumber: crewInfo.fireNumber
                  });

                  // Update the PDF ID in our state
                  setPdfsByDateRange(prev => ({
                    ...prev,
                    [currentDateRange]: newPdfId
                  }));
                  setPdfId(newPdfId);
                  
                  setShowPDFViewer(false);
                  setIsSigningMode(false);
                  showNotification('PDF saved with signature', 'success');
                } catch (error) {
                  console.error('Error saving signed PDF:', error);
                  showNotification('Failed to save signed PDF', 'error');
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MainTable;

// Add these styles to MainTable.css
const styles = `
.ctr-date-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
}

.ctr-select {
  padding: 0.5rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 200px;
  background-color: white;
}

.ctr-select:focus {
  outline: none;
  border-color: #d32f2f;
}

.calendar-btn {
  padding: 0.5rem;
  font-size: 1.2rem;
  background: none;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.calendar-btn:hover {
  background-color: #f5f5f5;
  border-color: #d32f2f;
}

.ctr-signature-section {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.ctr-signature-display {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.ctr-signature-content {
  flex: 1;
}

.ctr-signature-label {
  color: #666;
  font-weight: bold;
  margin-bottom: 8px;
}

.ctr-signature-name {
  color: #333;
  margin-bottom: 12px;
}

.ctr-signature-image {
  max-width: 300px;
  border: 1px solid #ddd;
  background: white;
  padding: 10px;
  border-radius: 4px;
}

.ctr-signature-image img {
  width: 100%;
  height: auto;
}

.signature-btn, .edit-signature-btn {
  background: #1976d2;
  white-space: nowrap;
}

.signature-btn:hover, .edit-signature-btn:hover {
  background: #1565c0;
}

@media (max-width: 768px) {
  .ctr-signature-section {
    padding: 10px;
  }

  .ctr-signature-display {
    flex-direction: column;
    gap: 10px;
  }

  .ctr-signature-image {
    max-width: 100%;
  }
}

.custom-date-picker {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

.custom-date-picker input {
  font-size: 16px;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.custom-date-picker input:focus {
  outline: none;
  border-color: #d32f2f;
}
`; 