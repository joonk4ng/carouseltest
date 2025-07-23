import React, { useEffect, useState } from 'react';

import '../styles/MainTable.css';
import { fillCTRPDF } from '../utils/fillCTRPDF';
import { fillExcelTemplate } from '../utils/fillExcelTemplate';
import { generateExportFilename } from '../utils/filenameGenerator';
import { stableCTRService } from '../db/stableDexieService';
import { saveCoordinator } from '../utils/saveCoordinator';
import { Notification } from './Notification';
import { mapExcelToData } from '../utils/excelMapping';
import { CrewMember, CrewInfo, Day, CellChange } from '../types/CTRTypes';
import { calculateTotalHours } from '../utils/timeCalculations';
import { DateCalendar } from './DateCalendar';

import EnhancedPDFViewer from './EnhancedPDFViewer';
import PDFPreviewViewer from './PDFPreviewViewer';
import PDFViewer from './PDFViewer';
import { storePDF, listPDFs, getPDF } from '../utils/pdfStorage';
import ExcelJS from 'exceljs';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import type { Workbook } from 'xlsx-populate';
import XLSX from 'xlsx';
import PrintableTable from './PrintableTable';
import '../styles/components/PrintableTable.css';
import { AutoSaveStatus } from './AutoSaveStatus';
import '../styles/AutoSaveStatus.css';
import { ThemeToggle } from './ThemeToggle';
import { storeImage, getImage, ImageData } from '../utils/imageStorage';



// TypeScript interfaces
interface EditingCell {
  row: number;
  field: string;
  dayIdx?: number;
}

interface UndoState {
  rowIndex: number;
  field: string;
  dayIndex?: number;
  savedValue: string;
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

const STORAGE_KEY = 'ctr-table-data';

function saveData(data: CrewMember[]) {
  // No longer needed since we're using IndexedDB
}

function loadData(): CrewMember[] {
  // No longer needed since we're using IndexedDB
  return [];
}

// function to perform a deep comparison of two objects
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

export default function MainTable() {
  const [data, setData] = useState<CrewMember[]>([]);
  
  const [dayCount, setDayCount] = useState(2);
  
  const [days, setDays] = useState<string[]>(['', '']);
  const [showSaveDefault, setShowSaveDefault] = useState(false);
  const [crewInfo, setCrewInfo] = useState<CrewInfo>({
    crewName: '',
    crewNumber: '',
    fireName: '',
    fireNumber: ''
  });

  // Add effect to keep header date synchronized with data
  useEffect(() => {
    if (data.length > 0 && data[0].days?.length > 0) {
      const firstDate = data[0].days[0].date;
      const secondDate = data[0].days[1]?.date || '';
      
      // Only update if dates are different to avoid infinite loop
      if (firstDate && (firstDate !== days[0] || secondDate !== days[1])) {
        setDays([firstDate, secondDate]);
      }
    }
  }, [data]);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [savedDates, setSavedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  // Add state to track last saved total hours
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
  const [showSettings, setShowSettings] = useState(false);

  const [showPDFViewer, setShowPDFViewer] = useState(false);
  const [pdfId, setPdfId] = useState<string | null>(null);

  // Add a new state to track PDFs for specific date ranges
  const [pdfsByDateRange, setPdfsByDateRange] = useState<Record<string, string>>({});

  // Add state for tracking if we're in signing mode
  const [isSigningMode, setIsSigningMode] = useState(false);
  
  // Add state to track if a PDF has been signed for this date range
  const [hasSignedPDF, setHasSignedPDF] = useState(false);
  
  // Add state to track PDF generation count for the current date range
  const [pdfGenerationCount, setPdfGenerationCount] = useState(0);

  // Add state for collapsible section

  const [checkboxStates, setCheckboxStates] = useState({
    noMealsLodging: false,
    noMeals: false,
    travel: false,
    noLunch: false,
    hotline: true  // Default to true
  });
  const [customEntries, setCustomEntries] = useState<string[]>([]);
  const [newEntry, setNewEntry] = useState('');

  // Add state for save status
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  
  // Add state for navigation debouncing
  const [isNavigating, setIsNavigating] = useState(false);

  // Legacy propagation state variables removed - now using simple propagation

  // Remove useUndo initialization and replace with simple undo state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  // Clear undo history when changing dates
  useEffect(() => {
    // clearHistory(); // This line is removed as per the edit hint
  }, [selectedDate]); // Removed clearHistory from dependency array

  // Remove the automatic state recording effect since we'll record manually on significant changes

  // Add state for undo functionality
  // const [lastEdit, setLastEdit] = useState<LastEdit | null>(null); // This line is removed as per the edit hint
  // const [canUndoLastEdit, setCanUndoLastEdit] = useState(false); // This line is removed as per the edit hint

  const handleCellClick = (rowIdx: number, field: string, dayIdx?: number) => {
    // Store the original value when clicking into a cell
    let originalValue = '';
    
    if (dayIdx !== undefined) {
      // Handle time entry fields
      const timeValue = data[rowIdx]?.days[dayIdx]?.[field as keyof Day];
      originalValue = typeof timeValue === 'string' ? timeValue : '';
    } else {
      // Handle name/classification fields
      const fieldValue = data[rowIdx]?.[field as keyof CrewMember];
      originalValue = typeof fieldValue === 'string' ? fieldValue : '';
    }

    // setLastEdit({ // This line is removed as per the edit hint
    //   rowIndex: rowIdx, // This line is removed as per the edit hint
    //   field, // This line is removed as per the edit hint
    //   dayIndex: dayIdx, // This line is removed as per the edit hint
    //   originalValue // This line is removed as per the edit hint
    // }); // This line is removed as per the edit hint
    // setCanUndoLastEdit(false); // This line is removed as per the edit hint
  };

  const handleCellEdit = async (e: React.ChangeEvent<HTMLInputElement>, rowIdx: number, field: string, dayIdx?: number) => {
    const newValue = e.target.value;
    console.log('🔄 MainTable: handleCellEdit called', {
      rowIdx,
      field,
      dayIdx,
      newValue,
      selectedDate,
      isSelectedDateSet: !!selectedDate
    });
    
    // Validate military time for on/off fields
    if ((field === 'on' || field === 'off')) {
      if (!/^\d*$/.test(newValue)) return;
      if (!validateMilitaryTime(newValue)) return;
    }

    // Create a copy of the current data
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

    // Update the data based on field type
    if (dayIdx !== undefined) {
      // Handle time entry fields
      if (!newData[rowIdx].days[dayIdx]) {
        newData[rowIdx].days[dayIdx] = { date: days[dayIdx] || '', on: '', off: '' };
      }
      newData[rowIdx].days[dayIdx][field as keyof Day] = newValue;

      // Copy times for second row
      if (rowIdx === 1) {
        for (let i = 2; i < newData.length; i++) {
          if (newData[i]?.name) {
            if (!newData[i].days[dayIdx]) {
              newData[i].days[dayIdx] = { date: days[dayIdx] || '', on: '', off: '' };
            }
            newData[i].days[dayIdx][field as keyof Day] = newValue;
          }
        }
      }
    } else {
      // Handle name and classification changes
      if (field === 'name' || field === 'classification') {
        (newData[rowIdx] as any)[field] = newValue;

        // Handle FFT time copying
        if (field === 'name' && newValue) {
          const fftIndex = newData.findIndex(member => 
            member?.classification?.toUpperCase().includes('FFT1') || 
            member?.classification?.toUpperCase().includes('FFT2')
          );

          if (fftIndex !== -1 && rowIdx > fftIndex && newData[fftIndex]?.days) {
            // Create a deep copy of the FFT times
            const fftTimes: Day[] = newData[fftIndex].days.map(day => ({
              date: day.date,
              on: day.on,
              off: day.off
            }));
            newData[rowIdx].days = fftTimes;
          }
        }
      }
    }

    // Update the data state
    setData(newData);
    setHasUnsavedChanges(true);

    // Queue changes for propagation instead of immediate propagation
    console.log('🔄 MainTable: Checking queueing conditions', {
      selectedDate,
      hasSelectedDate: !!selectedDate,
      selectedDateType: typeof selectedDate
    });
    
    // If there's a selected date
    if (selectedDate) {
      try {
        const oldValue = dayIdx !== undefined 
          ? (data[rowIdx]?.days?.[dayIdx]?.[field as keyof Day] || '')
          : (data[rowIdx]?.[field as keyof CrewMember] || '');
        
        // Get the change type
        const changeType = dayIdx !== undefined 
          ? 'time' as const
          : (field === 'name' ? 'name' as const : 'classification' as const);

        console.log('🔄 MainTable: Queueing change from cell edit', {
          rowIdx,
          field,
          dayIdx,
          oldValue,
          newValue,
          changeType,
          selectedDate
        });


      } catch (error) {
        console.error('🔄 MainTable: Error queueing change:', error);
        showNotification('Failed to queue change for propagation', 'error');
      }
    }
  };

  // Handles the cell blur event
  const handleCellBlur = async (field: string, newValue: string, rowIndex: number, dayIndex?: number) => {
    // Check if there's no selected date or data
    if (!selectedDate || !data) {
      console.log('handleCellBlur: No selectedDate or data', { selectedDate, data });
      return;
    }

    // Try to get the saved record from IndexedDB
    try {
      const savedRecord = await stableCTRService.getRecord(selectedDate);
      // If no saved record is found, return
      if (!savedRecord) {
        console.log('handleCellBlur: No saved record found for date', { selectedDate });
        return;
      }

      // Get the saved value
      let savedValue = '';
      // If the field is a time entry field, get the saved value
      if (dayIndex !== undefined) {
        const timeValue = savedRecord.data[rowIndex]?.days[dayIndex]?.[field as keyof Day];
        // If the saved value is a string, set it to the saved value
        savedValue = typeof timeValue === 'string' ? timeValue : '';
        console.log('handleCellBlur: Got saved time value', { 
          rowIndex, 
          dayIndex, 
          field, 
          timeValue, 
          savedValue,
          newValue 
        });
      } else {
        // If the field is a name or classification field, get the saved value
        const fieldValue = savedRecord.data[rowIndex]?.[field as keyof CrewMember];
        // If the saved value is a string, set it to the saved value
        savedValue = typeof fieldValue === 'string' ? fieldValue : '';
        console.log('handleCellBlur: Got saved field value', { 
          rowIndex, 
          field, 
          fieldValue, 
          savedValue,
          newValue 
        });
      }

      // If there's a difference between saved and new value
      if (savedValue !== newValue) {
        console.log('handleCellBlur: Value changed, enabling undo', {
          savedValue,
          newValue,
          rowIndex,
          field,
          dayIndex
        });
        
        // Enable undo with saved value
        setUndoState({
          rowIndex,
          field,
          dayIndex,
          savedValue
        });
        setCanUndo(true);

        // Save the current change
        await saveCoordinator.saveRecord({
          dateRange: selectedDate,
          data,
          crewInfo: {
            ...crewInfo,
            checkboxStates,
            customEntries
          },
          onProgress: (message) => {
            console.log('Save progress:', message);
          },
          onComplete: () => {
            setHasUnsavedChanges(false);
            setLastSaved(Date.now());
            console.log('Save completed:', { 
              dateRange: selectedDate,
              canUndo: true,
              undoState: {
                rowIndex,
                field,
                dayIndex,
                savedValue
              }
            });
          },
          // If there's an error, show a notification
          onError: (error) => {
            console.error('Save error:', error);
            showNotification('Failed to save changes. Please try again.', 'error');
          }
        });

        // Track changes for simple propagation (done in handleCellEdit)
        // No immediate propagation - changes will be applied on navigation
      } else {
        console.log('handleCellBlur: No value change, resetting undo state', {
          savedValue,
          newValue
        });
        // No changes, reset undo state
        setUndoState(null);
        setCanUndo(false);
      }
    } catch (error) {
      // If there's an error, show a notification
      console.error('Error in handleCellBlur:', error);
      showNotification('Error processing change', 'error');
    }
  };

  // Handles the undo operation
  const handleUndo = async () => {
    // Log the undo operation
    console.log('handleUndo: Starting undo operation', {
      undoState,
      canUndo
    });

    // Check if there's no undo state or if the undo is not enabled
    if (!undoState || !canUndo) {
      console.log('handleUndo: Cannot undo - no state or not enabled', {
        undoState,
        canUndo
      });
      return;
    }

    // Create a copy of the current data
    const newData = [...data];
    
    // If the undo state is a time entry field
    if (undoState.dayIndex !== undefined) {
      // Undo time entry field
      if (!newData[undoState.rowIndex]?.days[undoState.dayIndex]) {
        // Initialize days array if it doesn't exist
        if (!newData[undoState.rowIndex].days) {
          newData[undoState.rowIndex].days = days.map(date => ({ date, on: '', off: '' }));
        }
        // Initialize specific day if it doesn't exist
        newData[undoState.rowIndex].days[undoState.dayIndex] = { 
          date: days[undoState.dayIndex] || '', 
          on: '', 
          off: '' 
        };
      }
      // Log the undo operation
      console.log('handleUndo: Undoing time entry', {
        rowIndex: undoState.rowIndex,
        dayIndex: undoState.dayIndex,
        field: undoState.field,
        savedValue: undoState.savedValue
      });
      newData[undoState.rowIndex].days[undoState.dayIndex][undoState.field as keyof Day] = undoState.savedValue;
    } else {
      // Undo name/classification field
      if (!newData[undoState.rowIndex]) {
        newData[undoState.rowIndex] = {
          name: '',
          classification: '',
          days: days.map(date => ({ date, on: '', off: '' }))
        };
      }
      // Only update if it's a string field (name or classification)
      if (undoState.field === 'name' || undoState.field === 'classification') {
        console.log('handleUndo: Undoing field value', {
          rowIndex: undoState.rowIndex,
          field: undoState.field,
          savedValue: undoState.savedValue
        });
        newData[undoState.rowIndex][undoState.field] = undoState.savedValue;
      }
    }

    // Update the data state
    setData(newData);
    setHasUnsavedChanges(true);

    // Trigger save with the original value
    await handleCellBlur(
      undoState.field,
      undoState.savedValue,
      undoState.rowIndex,
      undoState.dayIndex
    );

    // Reset undo state
    console.log('handleUndo: Resetting undo state');
    setCanUndo(false);
    setUndoState(null);
  };

  // Handles the checkbox change
  const handleCheckboxChange = async (option: keyof typeof checkboxStates) => {
    // Set the checkbox states
    setCheckboxStates(prev => {
      const newStates = { ...prev };

      // If turning on travel, automatically uncheck hotline
      if (option === 'travel') {
        if (!prev.travel) {
          newStates.hotline = false;
        }
        newStates.travel = !prev.travel;
      } else if (option === 'hotline') {
        // If turning on hotline, automatically uncheck travel
        if (!prev.hotline) {
          newStates.travel = false;
        }
        newStates.hotline = !prev.hotline;
      } else {
        // For other checkboxes, toggle the state
        newStates[option] = !prev[option];
      }

      // Return the new states
      return newStates;
    });

    // Save after checkbox change
    try {
      setIsSaving(true);

      // Get the full date range
      const fullDateRange = selectedDate ? `${selectedDate} to ${days[1]}` : 'draft';

      // Save the record
      await saveCoordinator.saveRecord({
        dateRange: fullDateRange,
        data,
        crewInfo: {
          ...crewInfo,
          checkboxStates: {
            ...checkboxStates,
            [option]: !checkboxStates[option],
            ...(option === 'travel' && !checkboxStates.travel ? { hotline: false } : {})
          },
          customEntries
        },
        // If there's an error, show a notification
        onProgress: (message) => {
          console.log('Save progress:', message);
        },
        // If the save is complete, set the has unsaved changes to false, set the last saved to the current time, and log the save completed
        onComplete: () => {
          setHasUnsavedChanges(false);
          setLastSaved(Date.now());
          console.log('Save completed:', { dateRange: fullDateRange });
        },
        // If there's an error, show a notification
        onError: (error) => {
          console.error('Save error:', error);
          showNotification('Failed to save changes. Please try again.', 'error');
        }
      });
    } catch (error) {
      // If there's an error, show a notification
      console.error('Save error:', error);
      showNotification('Failed to save changes. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handles the add entry operation
  const handleAddEntry = async () => {
    // If the new entry is not empty and not already in the custom entries
    if (newEntry.trim() && !customEntries.includes(newEntry.trim())) {
      const updatedEntries = [...customEntries, newEntry.trim()];
      setCustomEntries(updatedEntries);
      setNewEntry('');

      // Save after adding entry
      try {
        setIsSaving(true);
        const fullDateRange = selectedDate ? `${selectedDate} to ${days[1]}` : 'draft';
        await saveCoordinator.saveRecord({
          dateRange: fullDateRange,
          data,
          crewInfo: {
            ...crewInfo,
            checkboxStates,
            customEntries: updatedEntries
          },
          onProgress: (message) => {
            console.log('Save progress:', message);
          },
          // If the save is complete, set the has unsaved changes to false, set the last saved to the current time, and log the save completed
          onComplete: () => {
            setHasUnsavedChanges(false);
            setLastSaved(Date.now());
            console.log('Save completed:', { dateRange: fullDateRange });
          },
          // If there's an error, show a notification
          onError: (error) => {
            console.error('Save error:', error);
            showNotification('Failed to save changes. Please try again.', 'error');
          }
        });
      } catch (error) {
        // If there's an error, show a notification
        console.error('Save error:', error);
        showNotification('Failed to save changes. Please try again.', 'error');
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Handles the remove custom entry operation
  const handleRemoveCustomEntry = async (entryToRemove: string) => {
    // Update the custom entries
    const updatedEntries = customEntries.filter(entry => entry !== entryToRemove);
    setCustomEntries(updatedEntries);

    // Save after removing entry
    try {
      setIsSaving(true);
      const fullDateRange = selectedDate ? `${selectedDate} to ${days[1]}` : 'draft';
      await saveCoordinator.saveRecord({
        dateRange: fullDateRange,
        data,
        crewInfo: {
          ...crewInfo,
          checkboxStates,
          customEntries: updatedEntries
        },
        // If there's an error, show a notification
        onProgress: (message) => {
          console.log('Save progress:', message);
        },
        // If the save is complete, set the has unsaved changes to false, set the last saved to the current time, and log the save completed
        onComplete: () => {
          setHasUnsavedChanges(false);
          setLastSaved(Date.now());
          console.log('Save completed:', { dateRange: fullDateRange });
        },
        // If there's an error, show a notification
        onError: (error) => {
          console.error('Save error:', error);
          showNotification('Failed to save changes. Please try again.', 'error');
        }
      });
    } catch (error) {
      // If there's an error, show a notification
      console.error('Save error:', error);
      showNotification('Failed to save changes. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handles the key press event
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
      const dateRanges = await stableCTRService.getAllDateRanges();
      
      // Load PDFs for all date ranges
      const pdfs = await listPDFs();
      const pdfMapping: Record<string, string> = {};
      pdfs.forEach((pdf: PDFData) => {
        const { date, crewNumber, fireName, fireNumber } = pdf.metadata;
        // Find the date range that matches this PDF's metadata
        const matchingDateRange = dateRanges.find((range: string) => {
          const [rangeDate] = range.split(' to ');
          return rangeDate === date && 
                 pdf.metadata.crewNumber === crewNumber &&
                 pdf.metadata.fireName === fireName &&
                 pdf.metadata.fireNumber === fireNumber;
        });
        // If the matching date range is found, add it to the pdf mapping
        if (matchingDateRange) {
          pdfMapping[matchingDateRange] = pdf.id;
        }
      });
      // Set the pdfs by date range
      setPdfsByDateRange(pdfMapping);

      // If there are date ranges, select the first one
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
    if (data.length > 0) {
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
    if (data.length > 0) {
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

    // Set the has unsaved changes
    setHasUnsavedChanges(hasChanges);
  }, [totalHours, crewInfo, days, lastSavedTotalHours, lastSavedCrewInfo, checkboxStates, customEntries, lastSavedState]);

  // Loads the saved dates
  const loadSavedDates = async () => {
    try {
      const dateRanges = await stableCTRService.getAllDateRanges();
      setSavedDates(dateRanges);
    } catch (error) {
      console.error('Error loading saved dates:', error);
    }
  };

  // Shows the notification
  const showNotification = (message: string, type: 'success' | 'info' | 'warning' | 'error') => {
    setNotification({ message, type, show: true });
  };

  // Hides the notification
  const hideNotification = () => {
    setNotification(prev => ({ ...prev, show: false }));
  };

  // Finds the current date index
  const findCurrentDateIndex = () => {
    if (!selectedDate) return -1;
    return savedDates.findIndex(date => date === selectedDate);
  };

  // Handles the previous entry operation
  const handlePreviousEntry = async () => {
    // Prevent rapid clicks - debounce navigation
    if (isNavigating || isSaving) {
      console.log('Navigation blocked - already navigating or saving');
      return;
    }

    // Set the is navigating to true
    setIsNavigating(true);

    // Try to find the current date index
    try {
      const currentIndex = findCurrentDateIndex();
      if (currentIndex > 0) {
      // Check for unsaved changes
      if (hasUnsavedChanges) {
        try {
          setIsSaving(true);
          const fullDateRange = selectedDate ? `${selectedDate} to ${days[1]}` : 'draft';
          await saveCoordinator.saveRecord({
            dateRange: fullDateRange,
            data,
            crewInfo: {
              ...crewInfo,
              checkboxStates,
              customEntries
            },
            // If there's an error, show a notification
            onProgress: (message) => {
              console.log('Save progress:', message);
            },
            // If the save is complete, set the has unsaved changes to false, set the last saved to the current time, and log the save completed
            onComplete: () => {
              setHasUnsavedChanges(false);
              setLastSaved(Date.now());
              console.log('Save completed:', { dateRange: fullDateRange });
            },
            // If there's an error, show a notification
            onError: (error) => {
              console.error('Save error:', error);
              showNotification('Failed to save changes. Please try again.', 'error');
              throw error; // Re-throw to prevent navigation
            }
          });
        } catch (error) {
          // If there's an error, show a notification
          console.error('Error saving before navigation:', error);
          showNotification('Failed to save changes before navigating. Please try again.', 'error');
          return; // Prevent navigation if save fails
        } finally {
          setIsSaving(false);
        }
      }
      // Get the previous date range
      const prevDateRange = savedDates[currentIndex - 1];
      // Navigate to the previous date range
      await handleDateSelect(prevDateRange);
      // Clear undo state after navigation
      setUndoState(null);
      setCanUndo(false);
    }
  } catch (error) {
    // If there's an error, show a notification
    console.error('Error in handlePreviousEntry:', error);
    showNotification('Failed to navigate to previous day. Please try again.', 'error');
  } finally {
    setIsNavigating(false);
  }
  };

  // Handles the next entry operation
  const handleNextEntry = async () => {
    // Prevent rapid clicks - debounce navigation
    if (isNavigating || isSaving) {
      console.log('Navigation blocked - already navigating or saving');
      return;
    }

    // Set the is navigating to true
    setIsNavigating(true);

    // Try to get the current date index
    try {
      // Check if there's data worth saving (names, times, crew info, etc.)
      const hasDataToSave = 
        data.some(member => member.name || member.classification || member.days.some(day => day.on || day.off)) ||
        crewInfo.crewName || crewInfo.crewNumber || crewInfo.fireName || crewInfo.fireNumber ||
        customEntries.length > 0 ||
        Object.values(checkboxStates).some(checked => checked);

    // Save current data if there's anything worth saving and we have dates
    if (hasDataToSave && data[0]?.days[0]?.date && data[0]?.days[1]?.date) {
      try {
        setIsSaving(true);
        const firstDate = data[0].days[0].date;
        const secondDate = data[0].days[1].date;
        const fullDateRange = `${firstDate} to ${secondDate}`;
        
        await saveCoordinator.saveRecord({
          dateRange: fullDateRange,
          data,
          crewInfo: {
            ...crewInfo,
            checkboxStates,
            customEntries
          },
          onProgress: (message) => {
            console.log('Save progress:', message);
          },
          onComplete: () => {
            setHasUnsavedChanges(false);
            setLastSaved(Date.now());
            console.log('Save completed:', { dateRange: fullDateRange });
          },
          onError: (error) => {
            console.error('Save error:', error);
            showNotification('Failed to save changes. Please try again.', 'error');
            throw error;
          }
        });
      } catch (error) {
        // If there's an error, show a notification
        console.error('Error saving before navigation:', error);
        showNotification('Failed to save changes before navigating. Please try again.', 'error');
        return;
      } finally {
        setIsSaving(false);
      }
    }

    // Get the current dates
    const firstDate = new Date(data[0].days[0].date);
    const secondDate = new Date(data[0].days[1].date);
    
    // Determine if we're in single-day or consecutive-days mode
    const isSingleDayMode = firstDate.getTime() === secondDate.getTime();
    const dayIncrement = isSingleDayMode ? 1 : 2;

    // Calculate next dates
    const nextFirstDate = new Date(firstDate);
    nextFirstDate.setDate(firstDate.getDate() + dayIncrement);
    const nextFirstDateString = nextFirstDate.toISOString().split('T')[0];

    // Calculate the next second date
    const nextSecondDate = new Date(nextFirstDate);
    if (!isSingleDayMode) {
      nextSecondDate.setDate(nextFirstDate.getDate() + 1);
    }
    const nextSecondDateString = nextSecondDate.toISOString().split('T')[0];

    // Calculate the next date range
    const nextDateRange = `${nextFirstDateString} to ${nextSecondDateString}`;

    // Check if the next date range already exists in the database
    // Check if next day already exists in the database
    const nextDateRangeExists = await stableCTRService.getRecord(nextDateRange);
    
    if (nextDateRangeExists) {
      // Navigate to existing next entry
      await handleDateSelect(nextDateRange);
      // Clear undo state after navigation
      setUndoState(null);
      setCanUndo(false);
    } else {
      // Create new entry by copying current data forward
      try {
        // Create new data with copied names/classifications but blank times
        const newData = data.map(member => ({
          name: member.name,
          classification: member.classification,
          days: [
            { date: nextFirstDateString, on: '', off: '' },
            { date: nextSecondDateString, on: '', off: '' }
          ]
        }));

        // Save the new record
        await saveCoordinator.saveRecord({
          dateRange: nextDateRange,
          data: newData,
          crewInfo: {
            ...crewInfo,
            checkboxStates,
            customEntries
          },
          onProgress: (message) => {
            console.log('Save progress:', message);
          },
          onComplete: () => {
            console.log('New day created:', { dateRange: nextDateRange });
          },
          onError: (error) => {
            console.error('Save error for new day:', error);
            throw error;
          }
        });

        // Add a small delay to ensure database operation completes
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Reload saved dates from database to ensure consistency
        const updatedDateRanges = await stableCTRService.getAllDateRanges();
        setSavedDates(updatedDateRanges);
        
        // Calculate the new index based on the updated dates array
        const newIndex = updatedDateRanges.findIndex(date => date === nextDateRange);
        
        // Navigate to the new day with the correct index
        // Defensive: Wait a bit more if the record is not found, then retry once
        let record = await stableCTRService.getRecord(nextDateRange);
        if (!record) {
          await new Promise(resolve => setTimeout(resolve, 200));
          record = await stableCTRService.getRecord(nextDateRange);
        }
        // If the record is found, navigate to the new day with the correct index
        if (record) {
          await handleDateSelect(nextDateRange, newIndex);
        } else {
          showNotification('New day was not found in the database. Please refresh.', 'error');
        }
        // If the record is not found, show a notification
        showNotification('New day created with crew data copied forward', 'success');
        
      } catch (error) {
        console.error('Error creating new day:', error);
        showNotification('Failed to create new day. Please try again.', 'error');
      }
    }
  } catch (error) {
    console.error('Error in handleNextEntry:', error);
    showNotification('Failed to navigate to next day. Please try again.', 'error');
  } finally {
    setIsNavigating(false);
  }
  };

  // Handles the date select operation
  const handleDateSelect = async (dateRange: string, providedIndex?: number) => {

    // If no date range is selected, reset to new entry state
    if (!dateRange || dateRange === "") {
      // If no date range is selected, reset to new entry state
      setData([]);
      setCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setDays(['', '']);
      setSelectedDate(null);
      setCurrentDateIndex(-1);
      setHasUnsavedChanges(false);
      setLastSavedTotalHours(0);
      setLastSavedCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setCheckboxStates({
        noMealsLodging: false,
        noMeals: false,
        travel: false,
        noLunch: false,
        hotline: true
      });
      setPdfId(null);
      setHasSignedPDF(false);
      setPdfGenerationCount(0);
      // Clear undo state when resetting to new entry
      setUndoState(null);
      setCanUndo(false);
      return;
    }

    if (dateRange === "new") {
      setData([]);
      setCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setDays(['', '']);
      setSelectedDate(null);
      setCurrentDateIndex(-1);
      setHasUnsavedChanges(false);
      setLastSavedTotalHours(0);
      setLastSavedCrewInfo({
        crewName: '',
        crewNumber: '',
        fireName: '',
        fireNumber: ''
      });
      setPdfId(null);
      setHasSignedPDF(false);
      setPdfGenerationCount(0);
      // Clear undo state when starting new entry
      setUndoState(null);
      setCanUndo(false);
      showNotification('New entry started', 'info');
      return;
    }

    try {
      const [date1, date2] = dateRange.split(' to ');
      const record = await stableCTRService.getRecord(dateRange);
      

      
      if (record) {
        // Load existing record
        setData(record.data);
        
        // Extract crew info fields first
        const savedCrewInfo = {
          crewName: record.crewInfo.crewName || '',
          crewNumber: record.crewInfo.crewNumber || '',
          fireName: record.crewInfo.fireName || '',
          fireNumber: record.crewInfo.fireNumber || ''
        };
        
        // Set checkbox states and custom entries separately
        setCheckboxStates(record.crewInfo.checkboxStates || {
          noMealsLodging: false,
          noMeals: false,
          travel: false,
          noLunch: false,
          hotline: true
        });
        setCustomEntries(record.crewInfo.customEntries || []);
        
        // Set crew info after ensuring all fields exist
        setCrewInfo(savedCrewInfo);
        
        setDays([date1, date2]);
        setSelectedDate(dateRange);
        // Update currentDateIndex based on the selected date range or provided index
        const newIndex = providedIndex !== undefined ? providedIndex : savedDates.findIndex(date => date === dateRange);
        setCurrentDateIndex(newIndex);
        setHasUnsavedChanges(false);
        
        // Set the PDF ID from the mapping, or null if no PDF exists for this date range
        setPdfId(pdfsByDateRange[dateRange] || null);
        // Check if this date range has a signed PDF
        const hasExistingPDF = !!pdfsByDateRange[dateRange];
        setHasSignedPDF(hasExistingPDF);
        // Set initial count based on whether PDF exists (1 if exists, 0 if not)
        setPdfGenerationCount(hasExistingPDF ? 1 : 0);
        // Clear undo state when loading existing record
        setUndoState(null);
        setCanUndo(false);
      } else {
        // Save current data with new date range
        const newData = data.map(member => ({
          ...member,
          days: member.days.map((day, idx) => ({
            ...day,
            date: idx === 0 ? date1 : date2
          }))
        }));
        
        setData(newData);
        setDays([date1, date2]);
        setSelectedDate(dateRange);
        setHasUnsavedChanges(true);
        
        // Save the new record
        await saveCoordinator.saveRecord({
          dateRange,
          data: newData,
          crewInfo: {
            ...crewInfo,
            checkboxStates,
            customEntries
          },
          onProgress: (message) => {
            console.log('Save progress:', message);
          },
          onComplete: () => {
            setHasUnsavedChanges(false);
            setLastSaved(Date.now());
            showNotification('Changes saved successfully', 'success');
            console.log('Save completed:', { dateRange });
          },
          onError: (error) => {
            console.error('Save error:', error);
            showNotification('Failed to save changes. Please try again.', 'error');
          }
        });
        // Clear undo state when creating new record
        setUndoState(null);
        setCanUndo(false);
      }
    } catch (error) {
      console.error('Error loading/saving record:', error);
      showNotification('Failed to load/save record', 'error');
    }
    
    // Don't clear changes - they're now updated to continue propagating
    // Only clear when explicitly starting a new entry or on error
    // Changes are updated via updateSourceDate() when propagation succeeds
  };

  const handleCellDoubleClick = (rowIdx: number, field: string, dayIdx?: number) => {
    setEditingCell({ row: rowIdx, field, dayIdx });
    handleCellClick(rowIdx, field, dayIdx);
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

  const handleCrewInfoChange = async (field: keyof CrewInfo, value: string) => {
    setCrewInfo(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  // Handles the crew info blur operation
  const handleCrewInfoBlur = async () => {
    // Try to save the record
    try {
      setIsSaving(true);

      // Get the full date range
      const fullDateRange = selectedDate ? `${selectedDate} to ${days[1]}` : 'draft';

      // Save the record
      await saveCoordinator.saveRecord({
        dateRange: fullDateRange,
        data,
        crewInfo: {
          ...crewInfo,
          checkboxStates,
          customEntries
        },
        onProgress: (message) => {
          console.log('Save progress:', message);
        },
        onComplete: () => {
          setHasUnsavedChanges(false);
          setLastSaved(Date.now());
          console.log('Save completed:', { dateRange: fullDateRange });
        },
        onError: (error) => {
          console.error('Save error:', error);
          showNotification('Failed to save changes. Please try again.', 'error');
        }
      });
    } catch (error) {
      console.error('Save error:', error);
      showNotification('Failed to save changes. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handles the export PDF operation
  const handleExportPDF = async () => {
    if (!selectedDate || !data) return;

    try {
      // Create a new enriched crew info
      const enrichedCrewInfo = {
        ...crewInfo,
        checkboxStates,
        customEntries
      };

      // Generate the PDF
      const pdfResult = await fillCTRPDF(data, enrichedCrewInfo, { downloadImmediately: false, returnBlob: true });
      if (!pdfResult.blob) {
        throw new Error('Failed to generate PDF blob');
      }

      const filename = generateExportFilename({
        date: selectedDate,
        crewNumber: crewInfo.crewNumber,
        fireName: crewInfo.fireName,
        fireNumber: crewInfo.fireNumber,
        type: 'PDF'
      });

      // Store PDF in IndexedDB
      const pdfId = await storePDF(pdfResult.blob, null, {
        filename,
        date: selectedDate,
        crewNumber: crewInfo.crewNumber,
        fireName: crewInfo.fireName,
        fireNumber: crewInfo.fireNumber
      });

      setPdfId(pdfId);
      setShowPDFViewer(true);
      setHasSignedPDF(true); // Mark that a PDF has been signed
      setPdfGenerationCount(prev => prev + 1); // Increment PDF generation counter
    } catch (error) {
      console.error('Error generating PDF:', error);
      showNotification('Failed to generate PDF. Please try again.', 'error');
    }
  };

  // Handles the remove entry operation
  const handleRemoveEntry = async () => {
    if (!selectedDate || !data) return;

    const newData = [...data];
    newData.pop(); // Remove the last entry
    setData(newData);
    setHasUnsavedChanges(true);
  };

  // Handles the header date change operation
  const handleHeaderDateChange = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const newDate = e.target.value;
    const newDays = days.map((d, i) => (i === idx ? newDate : d));
    setDays(newDays);
    
    // Update data with new date
    setData(data => data.map(row => ({
      ...row,
      days: row.days.map((day, i) => i === idx ? { ...day, date: newDate } : day)
    })));

    // Set the date range based on just the first date if we have it
    if (newDays[0]) {
      setSelectedDate(newDays[0]);
    }
  };

  // Handles the delete operation
  const handleDelete = (idx: number) => {
    const newData = data.filter((_, i) => i !== idx);
    setData(newData);
    setHasUnsavedChanges(true);
  };

  // Handles the excel upload operation (Found in Settings)
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create a new file reader
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        // Create a new workbook
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(event.target?.result as ArrayBuffer);
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          throw new Error('No worksheet found in Excel file');
        }

        const { crewMembers } = mapExcelToData(worksheet);
        setData(crewMembers);
        setHasUnsavedChanges(true);
        showNotification('Excel data imported successfully', 'success');
      } catch (error) {
        console.error('Error reading Excel file:', error);
        showNotification('Failed to import Excel data. Please check the file format.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Export Excel
  const handleExportExcel = async () => {
    // Check if selectedDate and data are defined
    if (!selectedDate || !data) return;

    // Generate Excel file
    try {
      const workbook = await fillExcelTemplate(data, crewInfo, days);

      // Write buffer to blob
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // Generate filename
      const filename = generateExportFilename({
        date: selectedDate,
        crewNumber: crewInfo.crewNumber,
        fireName: crewInfo.fireName,
        fireNumber: crewInfo.fireNumber,
        type: 'Excel'
      });

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating Excel:', error);
      showNotification('Failed to generate Excel file. Please try again.', 'error');
    }
  };

  // Reset to empty data
  const handleResetToDefault = () => {
    if (window.confirm('Are you sure you want to reset to empty data? This cannot be undone.')) {
      setData([]);
      setHasUnsavedChanges(true);
    }
  };

  // Debug logging for undo button state
  useEffect(() => {
    console.log('Undo button state:', { canUndo, isSaving, undoState });
  }, [canUndo, isSaving, undoState]);

  // Debug logging for Sign PDF button state
  useEffect(() => {
    console.log('Sign PDF button state:', { 
      selectedDate, 
      hasData: !!data, 
      isDisabled: !selectedDate || !data,
      showSettings 
    });
  }, [selectedDate, data, showSettings]);

  // Handles opening the PDF in a new tab for preview
  const handleOpenPDFPreview = async () => {
    if (!pdfId) {
      showNotification('No PDF available to preview', 'error');
      return;
    }

    try {
      // Get the PDF from storage
      const pdfData = await getPDF(pdfId);
      if (!pdfData) {
        showNotification('PDF not found in storage', 'error');
        return;
      }

      // Create a blob URL for the PDF
      const blobUrl = URL.createObjectURL(pdfData.pdf);
      
      // Open the PDF in a new tab
      const newWindow = window.open(blobUrl, '_blank');
      
      if (!newWindow) {
        showNotification('Please allow popups to view the PDF', 'error');
        URL.revokeObjectURL(blobUrl);
        return;
      }

      // Log the filename for debugging (the browser tab will show the blob URL, but we know the proper name)
      if (pdfData.metadata?.filename) {
        console.log('Opening PDF with filename:', pdfData.metadata.filename);
      }

      // Also trigger download with proper filename
      const downloadUrl = URL.createObjectURL(pdfData.pdf);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = pdfData.metadata?.filename || 'CTR_Document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      // Clean up the blob URL after a delay to ensure the new window has loaded
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);

    } catch (error) {
      console.error('Error opening PDF preview:', error);
      showNotification('Failed to open PDF preview', 'error');
    }
  };

  // Handles the sneaky save operation in printing table
  const sneakySave = async () => {
    // If there's no data, return
    if (!data.length) return;

    // Try to save the record
    try {
      setIsSaving(true);
      const firstDate = data[0].days[0]?.date;
      const secondDate = data[0].days[1]?.date;
      if (!firstDate || !secondDate) return;
      const fullDateRange = `${firstDate} to ${secondDate}`;
      await saveCoordinator.saveRecord({
        dateRange: fullDateRange,
        data,
        crewInfo: {
          ...crewInfo,
          checkboxStates,
          customEntries
        },
        // If there's an error, show a notification
        onProgress: (message) => {
          console.log('Sneaky save progress:', message);
        },
        // If the save is complete, set the has unsaved changes to false, set the last saved to the current time, and log the save completed
        onComplete: () => {
          setHasUnsavedChanges(false);
          setLastSaved(Date.now());
          showNotification('Checkpoint saved before printing', 'success');
        },
        // If there's an error, show a notification
        onError: (error) => {
          console.error('Sneaky save error:', error);
          showNotification('Failed to save checkpoint before printing', 'error');
        }
      });
    } catch (error) {
      // If there's an error, show a notification
      console.error('Sneaky save error:', error);
      showNotification('Failed to save checkpoint before printing', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Add state for image storage
  const [imageId, setImageId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Load image for selected date
  useEffect(() => {
    const loadImage = async () => {
      if (!selectedDate) {
        setImageId(null);
        setImageUrl(null);
        return;
      }
      const id = `${selectedDate}_${crewInfo.crewNumber}_${crewInfo.fireName}_${crewInfo.fireNumber}`;
      setImageId(id);
      const imgData = await getImage(id);
      if (imgData && imgData.image) {
        setImageUrl(URL.createObjectURL(imgData.image));
      } else {
        setImageUrl(null);
      }
    };
    loadImage();
    // Clean up object URL on unmount/change
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, crewInfo.crewNumber, crewInfo.fireName, crewInfo.fireNumber]);

  // Handle image upload/take
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedDate) return;
    // Only allow image types
    if (!file.type.startsWith('image/')) {
      showNotification('Please select a valid image file.', 'error');
      return;
    }
    // Store with minimal compression (original file)
    const filename = `${selectedDate}_${crewInfo.crewNumber}_${crewInfo.fireName}_${crewInfo.fireNumber}_image.${file.name.split('.').pop()}`;
    const id = await storeImage(file, {
      filename,
      date: selectedDate,
      crewNumber: crewInfo.crewNumber,
      fireName: crewInfo.fireName,
      fireNumber: crewInfo.fireNumber,
      mimeType: file.type,
    });
    setImageId(id);
    setImageUrl(URL.createObjectURL(file));
    showNotification('Image saved for this date entry.', 'success');
  };

  // Handle image click (view/download)
  const handleOpenImage = async () => {
    if (!imageId) {
      showNotification('No image available to view', 'error');
      return;
    }
    const imgData = await getImage(imageId);
    if (!imgData || !imgData.image) {
      showNotification('Image not found in storage', 'error');
      return;
    }
    const url = URL.createObjectURL(imgData.image);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="ctr-container">
      <div className="ctr-sticky-header">
        <div className="ctr-header-stack">
          <div className="ctr-date-selector">
            <button 
              className="ctr-btn calendar-btn primary"
              onClick={() => setShowCalendar(true)}
              title="Open Calendar View"
            >
              📅 Select Date
            </button>
            <div className="ctr-current-date">
              {selectedDate ? (
                <div className="date-range">
                  {selectedDate.split(' to ')[0]}
                </div>
              ) : (
                <div className="no-date">No date selected</div>
              )}
            </div>
          </div>
          <button
            className="ctr-btn undo-btn"
            onClick={handleUndo}
            disabled={!canUndo || isSaving}
            title={canUndo ? "Undo last change" : "No changes to undo"}
          >
            <span>↩</span> <span className="undo-text">Undo</span>
          </button>
        </div>
      </div>

      <div className="ctr-controls">
        <div className="ctr-navigation">
          <button
            className="ctr-btn"
            onClick={handlePreviousEntry}
            disabled={currentDateIndex <= 0 || isNavigating || isSaving}
            style={{ background: currentDateIndex <= 0 || isNavigating || isSaving ? '#ccc' : '#ff9800' }}
          >
            ← Previous Day
          </button>
          <button
            className="ctr-btn"
            onClick={handleNextEntry}
            disabled={!data[0]?.days[0]?.date || !data[0]?.days[1]?.date || isNavigating || isSaving}
            style={{ background: !data[0]?.days[0]?.date || !data[0]?.days[1]?.date || isNavigating || isSaving ? '#ccc' : '#ff9800' }}
          >
            Next Day →
          </button>
        </div>
      </div>

      {notification.show && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={hideNotification}
        />
      )}
      
      <AutoSaveStatus
        dateRange={selectedDate}
        isSaving={isSaving}
        lastSaved={lastSaved}
      />
      

      
      <h2 className="ctr-title">Crew Time Report Table</h2>
      
      <div className="crew-info-section">
        <div className="crew-info-grid">
          <div className="crew-info-field">
            <label htmlFor="crew-name-input">Crew Name:</label>
            <input
              id="crew-name-input"
              type="text"
              value={crewInfo.crewName}
              onChange={(e) => handleCrewInfoChange('crewName', e.target.value)}
              onBlur={handleCrewInfoBlur}
              autoComplete="off"
              inputMode="text"
              data-lpignore="true"
            />
          </div>
          <div className="crew-info-field">
            <label htmlFor="crew-number-input">Crew Number:</label>
            <input
              id="crew-number-input"
              type="text"
              value={crewInfo.crewNumber}
              onChange={(e) => handleCrewInfoChange('crewNumber', e.target.value)}
              onBlur={handleCrewInfoBlur}
              autoComplete="off"
              inputMode="text"
              data-lpignore="true"
            />
          </div>
          <div className="crew-info-field">
            <label htmlFor="fire-name-input">Fire Name:</label>
            <input
              id="fire-name-input"
              type="text"
              value={crewInfo.fireName}
              onChange={(e) => handleCrewInfoChange('fireName', e.target.value)}
              onBlur={handleCrewInfoBlur}
              autoComplete="off"
              inputMode="text"
              data-lpignore="true"
            />
          </div>
          <div className="crew-info-field">
            <label htmlFor="fire-number-input">Fire Number:</label>
            <input
              id="fire-number-input"
              type="text"
              value={crewInfo.fireNumber}
              onChange={(e) => handleCrewInfoChange('fireNumber', e.target.value)}
              onBlur={handleCrewInfoBlur}
              autoComplete="off"
              inputMode="text"
              data-lpignore="true"
            />
          </div>
        </div>
      </div>

      {/* Remarks Section */}
      <div className="remarks-section">
        <h3 className="remarks-title">Remarks</h3>
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
                placeholder="Add new remark..."
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

      <div className="ctr-actions">
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <button 
            className="ctr-btn" 
            onClick={handleExportPDF}
            disabled={!selectedDate || !data}
            style={{ background: !selectedDate || !data ? '#ccc' : '#1976d2' }}
          >
            {pdfGenerationCount > 0 ? 'Sign New PDF' : 'Sign PDF'}
          </button>
          <PrintableTable 
            data={data} 
            crewInfo={{
              ...crewInfo,
              checkboxStates,
              customEntries
            }} 
            days={days} 
            onBeforePrint={sneakySave}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', alignItems: 'stretch', width: '100%' }}>
          {/* PDF Panel */}
          <div className="pdf-mini-viewport" style={{ flex: 1, minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', height: 340, justifyContent: 'flex-start' }}>
            <div className="pdf-mini-header" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', height: 32 }}>
              <h4 style={{ margin: 0, fontWeight: 600, fontSize: 18, textAlign: 'left', lineHeight: '32px' }}>Generated PDF</h4>
            </div>
            <div className="pdf-mini-container" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {pdfId ? (
                <div 
                  className="pdf-mini-preview"
                  onClick={handleOpenPDFPreview}
                  style={{ 
                    width: '100%',
                    height: '100%',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    position: 'relative',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Click to open PDF in new tab and download"
                >
                  <PDFViewer 
                    pdfId={pdfId}
                    style={{ width: '100%', height: '100%' }}
                  />
                  <div 
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      pointerEvents: 'none',
                      opacity: 0,
                      transition: 'opacity 0.2s'
                    }}
                    className="pdf-preview-overlay"
                  >
                    Click to open & download PDF
                  </div>
                </div>
              ) : (
                <span style={{ color: '#aaa', fontSize: 16 }}>No PDF for this date</span>
              )}
            </div>
          </div>
          {/* Image Panel */}
          <div className="image-mini-viewport" style={{ flex: 1, minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', height: 340, justifyContent: 'flex-start' }}>
            <div className="image-mini-header">
              <h4>Date Image</h4>
            </div>
            <div className="image-mini-container" onClick={imageUrl ? handleOpenImage : undefined} title={imageUrl ? 'Click to view/download image' : 'No image for this date'}>
              {imageUrl ? (
                <img src={imageUrl} alt="Date Entry" />
              ) : (
                <span style={{ color: '#aaa', fontSize: 16 }}>No image for this date</span>
              )}
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <label className="ctr-btn" style={{ cursor: 'pointer', fontSize: 14, marginBottom: 4 }}>
                Take/Upload Image
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImageUpload} />
              </label>
              {imageUrl && (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#666' }}>
                  Click image to view/download
                </div>
              )}
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
            <EnhancedPDFViewer
              pdfId={pdfId}
              readOnly={false}
              crewInfo={{
                crewNumber: crewInfo.crewNumber,
                fireName: crewInfo.fireName,
                fireNumber: crewInfo.fireNumber
              }}
              date={days[0]}
              onBeforeSign={sneakySave}
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

      {/* Settings container moved to bottom */}
      <div className="settings-container">
        <button 
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <div className={`settings-panel ${showSettings ? 'open' : ''}`}>
          <div className="settings-btn-group">
            <label className="settings-btn-item file-input-label">
              <input type="file" accept=".xlsx" onChange={handleExcelUpload} />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              Import Excel
            </label>
            <button className="settings-btn-item" onClick={handleExportExcel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              Export Excel
            </button>
            <button className="settings-btn-item" onClick={handleResetToDefault}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 919-9 9.75 9.75 0 017.071 3.172L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-7.071-3.172L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              Reset to Default
            </button>

            <button 
              className="settings-btn-item" 
              onClick={handleRemoveEntry}
              disabled={!selectedDate}
              style={{ background: !selectedDate ? '#ccc' : '#d32f2f' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Remove Entry
            </button>
            <div className="settings-btn-item theme-toggle-wrapper">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Simple propagation - no indicators needed */}
    </div>
  );
}

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