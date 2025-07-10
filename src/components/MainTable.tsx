import React, { useEffect, useState } from 'react';
import { defaultData } from '../data/defaultData';
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
import PDFGenerationViewer from './PDFGenerationViewer';
import EnhancedPDFViewer from './EnhancedPDFViewer';
import { storePDF, listPDFs } from '../utils/pdfStorage';
import ExcelJS from 'exceljs';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import type { Workbook } from 'xlsx-populate';
import XLSX from 'xlsx';
import PrintableTable from './PrintableTable';
import '../styles/components/PrintableTable.css';
import { AutoSaveStatus } from './AutoSaveStatus';
import '../styles/AutoSaveStatus.css';
import { propagateChangesForward } from '../utils/changePropagate';
import { PropagationIndicator } from './PropagationIndicator';
import { ThemeToggle } from './ThemeToggle';


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

export default function MainTable() {
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

  // Add state for collapsible section
  const [isCollapsed, setIsCollapsed] = useState(false);
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

  const [isPropagating, setIsPropagating] = useState(false);
  const [propagationMessage, setPropagationMessage] = useState('');

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
    console.log('handleCellEdit: Starting edit', {
      rowIdx,
      field,
      dayIdx,
      newValue
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

    // Propagate changes if needed
    if (isPropagating) {
      try {
        const changes: CellChange[] = [{
          field,
          oldValue: field === 'days' ? JSON.stringify(data[rowIdx].days) : (data[rowIdx][field as keyof CrewMember] || ''),
          newValue: field === 'days' ? JSON.stringify(newData[rowIdx].days) : newValue
        }];
        await propagateChangesForward(changes, selectedDate || '');
      } catch (error) {
        console.error('Error propagating changes:', error);
        showNotification('Failed to propagate changes forward', 'error');
      }
    }
  };

  const handleCellBlur = async (field: string, newValue: string, rowIndex: number, dayIndex?: number) => {
    if (!selectedDate || !data) {
      console.log('handleCellBlur: No selectedDate or data', { selectedDate, data });
      return;
    }

    try {
      // Get the saved state from IndexedDB
      const savedRecord = await stableCTRService.getRecord(selectedDate);
      if (!savedRecord) {
        console.log('handleCellBlur: No saved record found for date', { selectedDate });
        return;
      }

      // Get the saved value
      let savedValue = '';
      if (dayIndex !== undefined) {
        const timeValue = savedRecord.data[rowIndex]?.days[dayIndex]?.[field as keyof Day];
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
        const fieldValue = savedRecord.data[rowIndex]?.[field as keyof CrewMember];
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
          onError: (error) => {
            console.error('Save error:', error);
            showNotification('Failed to save changes. Please try again.', 'error');
          }
        });

        // Handle propagation if needed
        if (isPropagating) {
          setIsPropagating(true);
          setPropagationMessage(`Updating future schedules...`);

          try {
            const change: CellChange = {
              field,
              oldValue: savedValue,
              newValue
            };
            
            await propagateChangesForward([change], selectedDate);
            setPropagationMessage('Future schedules updated');
            setTimeout(() => {
              setIsPropagating(false);
            }, 2000);
          } catch (error) {
            console.error('Error propagating changes:', error);
            setPropagationMessage('Failed to update future schedules');
            setTimeout(() => {
              setIsPropagating(false);
            }, 3000);
          }
        }
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
      console.error('Error in handleCellBlur:', error);
      showNotification('Error processing change', 'error');
    }
  };

  const handleUndo = async () => {
    console.log('handleUndo: Starting undo operation', {
      undoState,
      canUndo
    });

    if (!undoState || !canUndo) {
      console.log('handleUndo: Cannot undo - no state or not enabled', {
        undoState,
        canUndo
      });
      return;
    }

    const newData = [...data];
    
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

  const handleCheckboxChange = async (option: keyof typeof checkboxStates) => {
    // Record state before making the change
    // recordState({ // This line is removed as per the edit hint
    //   data, // This line is removed as per the edit hint
    //   crewInfo, // This line is removed as per the edit hint
    //   checkboxStates, // This line is removed as per the edit hint
    //   customEntries // This line is removed as per the edit hint
    // }); // This line is removed as per the edit hint

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

    // Save after checkbox change
    try {
      setIsSaving(true);
      const fullDateRange = selectedDate ? `${selectedDate} to ${days[1]}` : 'draft';
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

  const handleAddEntry = async () => {
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
    }
  };

  const handleRemoveCustomEntry = async (entryToRemove: string) => {
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
      const dateRanges = await stableCTRService.getAllDateRanges();
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

  const findCurrentDateIndex = () => {
    if (!selectedDate) return -1;
    return savedDates.findIndex(date => date === selectedDate);
  };

  const handlePreviousEntry = async () => {
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
              throw error; // Re-throw to prevent navigation
            }
          });
        } catch (error) {
          console.error('Error saving before navigation:', error);
          showNotification('Failed to save changes before navigating. Please try again.', 'error');
          return; // Prevent navigation if save fails
        } finally {
          setIsSaving(false);
        }
      }
      const prevDateRange = savedDates[currentIndex - 1];
      await handleDateSelect(prevDateRange);
    }
  };

  const handleNextEntry = async () => {
    const currentIndex = findCurrentDateIndex();
    if (currentIndex < savedDates.length - 1) {
      // Check for unsaved changes
      if (hasUnsavedChanges) {
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

      const nextSecondDate = new Date(nextFirstDate);
      if (!isSingleDayMode) {
        nextSecondDate.setDate(nextFirstDate.getDate() + 1);
      }
      const nextSecondDateString = nextSecondDate.toISOString().split('T')[0];
      
      // Use the calculated dates for navigation
      const nextDateRange = `${nextFirstDateString} to ${nextSecondDateString}`;
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
      return;
    }

    if (dateRange === "new") {
      setData(defaultData);
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
        // Update currentDateIndex based on the selected date range
        const newIndex = savedDates.findIndex(date => date === dateRange);
        setCurrentDateIndex(newIndex);
        setHasUnsavedChanges(false);
        
        // Set the PDF ID from the mapping, or null if no PDF exists for this date range
        setPdfId(pdfsByDateRange[dateRange] || null);
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
      }
    } catch (error) {
      console.error('Error loading/saving record:', error);
      showNotification('Failed to load/save record', 'error');
    }
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

  const handleCrewInfoBlur = async () => {
    // Record state before saving
    // recordState({ // This line is removed as per the edit hint
    //   data, // This line is removed as per the edit hint
    //   crewInfo, // This line is removed as per the edit hint
    //   checkboxStates, // This line is removed as per the edit hint
    //   customEntries // This line is removed as per the edit hint
    // }); // This line is removed as per the edit hint

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

  const handleCopyToNext20Days = async () => {
    if (!selectedDate || !data || data.length === 0) {
      showNotification('No data to copy. Please enter data first.', 'warning');
      return;
    }

    try {
      // Get the current dates
      const firstDate = new Date(data[0].days[0].date);
      const secondDate = new Date(data[0].days[1].date);
      
      if (isNaN(firstDate.getTime()) || isNaN(secondDate.getTime())) {
        throw new Error('Invalid date format');
      }

      // Determine if we're in single-day or consecutive-days mode
      const isSingleDayMode = firstDate.getTime() === secondDate.getTime();
      const dayIncrement = isSingleDayMode ? 1 : 2; // Increment by 1 or 2 based on mode

      // Save current date's data first to ensure it's in the database
      const currentDateString = firstDate.toISOString().split('T')[0];
      const secondDateString = secondDate.toISOString().split('T')[0];
      await saveCoordinator.saveRecord({
        dateRange: `${currentDateString} to ${secondDateString}`,
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
          console.log('Save completed for current dates:', currentDateString, secondDateString);
        },
        onError: (error) => {
          console.error('Save error for current dates:', currentDateString, secondDateString, error);
          throw error;
        }
      });

      // Get template data from current day
      const templateData = data.map(member => ({
        ...member,
        days: member.days.slice(0, 2) // Take both days as template
      }));

      // Create and save entries for next 20 days/periods
      const newDates = [];
      for (let i = 1; i <= 20; i++) {
        // Calculate first date of the period
        const nextFirstDate = new Date(firstDate);
        nextFirstDate.setDate(firstDate.getDate() + (i * dayIncrement));
        const nextFirstDateString = nextFirstDate.toISOString().split('T')[0];

        // Calculate second date of the period
        const nextSecondDate = new Date(nextFirstDate);
        if (!isSingleDayMode) {
          nextSecondDate.setDate(nextFirstDate.getDate() + 1); // For consecutive days mode
        }
        const nextSecondDateString = nextSecondDate.toISOString().split('T')[0];

        newDates.push(`${nextFirstDateString} to ${nextSecondDateString}`);
        
        // Create new data for this period
        const newData = templateData.map(member => ({
          ...member,
          days: [
            { date: nextFirstDateString, on: member.days[0].on, off: member.days[0].off },
            { date: nextSecondDateString, on: member.days[1].on, off: member.days[1].off }
          ]
        }));

        // Save the record for this period
        await saveCoordinator.saveRecord({
          dateRange: `${nextFirstDateString} to ${nextSecondDateString}`,
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
            console.log('Save completed for dates:', nextFirstDateString, nextSecondDateString);
          },
          onError: (error) => {
            console.error('Save error for dates:', nextFirstDateString, nextSecondDateString, error);
            throw error;
          }
        });
      }

      // Update saved dates in state
      const allDates = [`${currentDateString} to ${secondDateString}`, ...newDates];
      setSavedDates(prev => {
        const uniqueDates = Array.from(new Set([...prev, ...allDates])).sort();
        return uniqueDates;
      });

      showNotification('Successfully copied data to next 20 days', 'success');
      
      // Force reload saved dates from database to ensure everything is in sync
      await loadSavedDates();
      
    } catch (error) {
      console.error('Error copying to next 20 days:', error);
      showNotification('Failed to copy data. Please check the date format and ensure times are entered.', 'error');
    }
  };

  const handleExportPDF = async () => {
    if (!selectedDate || !data) return;

    try {
      const pdfResult = await fillCTRPDF(data, crewInfo, { downloadImmediately: false, returnBlob: true });
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
    } catch (error) {
      console.error('Error generating PDF:', error);
      showNotification('Failed to generate PDF. Please try again.', 'error');
    }
  };

  const handleRemoveEntry = async () => {
    if (!selectedDate || !data) return;

    const newData = [...data];
    newData.pop(); // Remove the last entry
    setData(newData);
    setHasUnsavedChanges(true);
  };

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

  const handleDelete = (idx: number) => {
    const newData = data.filter((_, i) => i !== idx);
    setData(newData);
    setHasUnsavedChanges(true);
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
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

  const handleExportExcel = async () => {
    if (!selectedDate || !data) return;

    try {
      const workbook = await fillExcelTemplate(data, crewInfo, days);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

  const handleResetToDefault = () => {
    if (window.confirm('Are you sure you want to reset to default data? This cannot be undone.')) {
      setData(defaultData);
      setHasUnsavedChanges(true);
    }
  };

  // Debug logging for undo button state
  useEffect(() => {
    console.log('Undo button state:', { canUndo, isSaving, undoState });
  }, [canUndo, isSaving, undoState]);

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
            disabled={currentDateIndex <= 0}
          >
            ← Previous Day
          </button>
          <button
            className="ctr-btn"
            onClick={handleNextEntry}
            disabled={currentDateIndex >= savedDates.length - 1}
          >
            Next Day →
          </button>
          <button
            className="ctr-btn ctr-copy-button"
            onClick={handleCopyToNext20Days}
            disabled={isSaving}
          >
            Copy to Next 20 Days
          </button>
        </div>
        <div className="ctr-theme-toggle">
          <ThemeToggle />
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
      <div className="collapsible-section">
        <button 
          className="collapse-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? '▼' : '▲'} Remarks
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
      </div>

      <div className="ctr-actions">
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
        <button 
          className="ctr-btn" 
          onClick={handleRemoveEntry}
          disabled={!selectedDate}
          style={{ background: '#d32f2f' }}
        >
          Remove Entry
        </button>
      </div>
      <div className="ctr-table-container">
        <table className="ctr-table">
          <thead>
            <tr>
              <th className="ctr-th name" rowSpan={2}>NAME</th>
              <th className="ctr-th class" rowSpan={2}>JOB TITLE</th>
              {days.map((date, i) => (
                <th className="ctr-th date" colSpan={2} key={i}>
                  DATE<br />
                  <input
                    className="ctr-input ctr-date"
                    type="date"
                    value={date}
                    onChange={e => handleHeaderDateChange(e, i)}
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
                        onBlur={e => handleCellBlur('name', e.target.value, idx)}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="ctr-cell-content"
                        onDoubleClick={!isTouchDevice ? () => handleCellDoubleClick(idx, 'name') : undefined}
                        onClick={isTouchDevice ? () => handleCellDoubleClick(idx, 'name') : undefined}
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
                        onBlur={e => handleCellBlur('classification', e.target.value, idx)}
                        autoFocus
                      />
                    ) : (
                      <div
                        className="ctr-cell-content"
                        onDoubleClick={!isTouchDevice ? () => handleCellDoubleClick(idx, 'classification') : undefined}
                        onClick={isTouchDevice ? () => handleCellDoubleClick(idx, 'classification') : undefined}
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
                            onBlur={e => handleCellBlur('on', e.target.value, idx)}
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
                            onClick={isTouchDevice ? () => handleCellDoubleClick(idx, 'on', dayIdx) : undefined}
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
                            onBlur={e => handleCellBlur('off', e.target.value, idx)}
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
                            onClick={isTouchDevice ? () => handleCellDoubleClick(idx, 'off', dayIdx) : undefined}
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
              Finished
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
                <path d="M3 12a9 9 0 019-9 9.75 9.75 0 017.071 3.172L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-7.071-3.172L3 16" />
                <path d="M3 21v-5h5" />
              </svg>
              Reset to Default
            </button>
          </div>
        </div>
      </div>

      <PropagationIndicator 
        isVisible={isPropagating}
        message={propagationMessage}
      />
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