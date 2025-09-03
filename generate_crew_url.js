// Generate URL for Dust Busters Plus crew
function generateDustBustersUrl() {
  const baseUrl = 'https://joonk4ng.github.io';
  const params = new URLSearchParams();
  
  // Crew Information
  // DO NOT MODIFY crewName
  params.set('crewName', 'Dust Busters Plus');
  // Modify the second value ex: C69 -> C70
  params.set('crewNumber', 'C69');
  // Modify the second value ex: 2025 RMA Preposition -> 2025 RMA Preposition 2
  params.set('fireName', '2025 RMA Preposition');
  // Modify the second value ex: CO RMC 250002 -> CO RMC 250003
  params.set('fireNumber', 'CO RMC 250002');
  
  // Date parameter (optional) - uncomment and modify as needed
  // Single date format: YYYY-MM-DD
  // params.set('date', '2025-01-15');
  
  // Date range format: YYYY-MM-DD to YYYY-MM-DD
  // params.set('date', '2025-01-15 to 2025-01-16');
  
  // Crew Members Data (encoded as JSON)
  // Modify 'Sawyer McCall' to the first name and last name of the first crew member
  // Modify 'CRWB' to the classification of the first crew member
  const crewMembers = [
    { name: 'Sawyer McCall', classification: 'CRWB' },
    { name: 'Peyton Riley Cordell', classification: 'FFT2' },
    { name: 'Joel Matthew Rouse', classification: 'FFT2' },
    { name: 'Jose Eduardo Torres Garcia', classification: 'FFT2' },
    { name: 'Maddison Martinez Talamantes', classification: 'FFT2' },
    { name: 'Cody Koivu', classification: 'FFT2' },
    { name: 'Chad Allen', classification: 'FFT2' },
    { name: 'Raymar Salazar', classification: 'FFT2' },
    { name: 'Keagan Schnoor', classification: 'FFT2' },
    { name: 'Angeni Marie Yeo', classification: 'FFT2' },
    { name: 'Eli Durning', classification: 'FFT2' },
    { name: 'Jason Weber', classification: 'FFT1' },
    { name: 'Killian Powers', classification: 'FFT2' },
    { name: 'Clarance David Byrd', classification: 'FFT1' },
    { name: 'Eric Machtmes', classification: 'FFT2' },
    { name: 'Wiley Peebles', classification: 'FFT2' },
    { name: 'Dallas Riddle Stevens', classification: 'FFT2' },
    { name: 'Bradley Gerald Kline', classification: 'FFT1' }
  ];
  
  params.set('crewData', JSON.stringify(crewMembers));
  
  return `${baseUrl}?${params.toString()}`;
}

// Generate URLs with different date configurations
function generateUrlsWithDates() {
  const baseUrl = 'https://joonk4ng.github.io';
  const baseParams = new URLSearchParams();
  
  // Base crew information
  baseParams.set('crewName', 'Dust Busters Plus');
  baseParams.set('crewNumber', 'C69');
  baseParams.set('fireName', '2025 RMA Preposition');
  baseParams.set('fireNumber', 'CO RMC 250002');
  
  // Crew members data
  const crewMembers = [
    { name: 'Sawyer McCall', classification: 'CRWB' },
    { name: 'Peyton Riley Cordell', classification: 'FFT2' }
  ];
  baseParams.set('crewData', JSON.stringify(crewMembers));
  
  // URL with single date
  const singleDateParams = new URLSearchParams(baseParams);
  singleDateParams.set('date', '2025-01-15');
  const singleDateUrl = `${baseUrl}?${singleDateParams.toString()}`;
  
  // URL with date range
  const dateRangeParams = new URLSearchParams(baseParams);
  dateRangeParams.set('date', '2025-01-15 to 2025-01-16');
  const dateRangeUrl = `${baseUrl}?${dateRangeParams.toString()}`;
  
  // URL without date
  const noDateUrl = `${baseUrl}?${baseParams.toString()}`;
  
  return {
    singleDate: singleDateUrl,
    dateRange: dateRangeUrl,
    noDate: noDateUrl
  };
}

// Generate and display the URLs
console.log('=== Dust Busters Plus URL Generator ===\n');

// Original URL (no date)
const url = generateDustBustersUrl();
console.log('1. URL with crew info only:');
console.log(url);
console.log('');

// URLs with different date configurations
const dateUrls = generateUrlsWithDates();
console.log('2. URL with single date:');
console.log(dateUrls.singleDate);
console.log('');
console.log('3. URL with date range:');
console.log(dateUrls.dateRange);
console.log('');
console.log('4. URL without date:');
console.log(dateUrls.noDate);
console.log('');

// Also create a simpler URL with just crew info
const simpleUrl = `https://joonk4ng.github.io?crewName=${encodeURIComponent('Dust Busters Plus')}&crewNumber=${encodeURIComponent('C69')}&fireName=${encodeURIComponent('2025 RMA Preposition')}&fireNumber=${encodeURIComponent('CO RMC 250002')}`;

console.log('5. Simple URL (crew info only):');
console.log(simpleUrl);
console.log('');

console.log('=== Usage Instructions ===');
console.log('1. Copy any of the URLs above');
console.log('2. Paste into your browser');
console.log('3. The PWA will automatically load with the crew information and date (if specified)');
console.log('4. URL parameters will be cleared after loading');
console.log('');
console.log('=== Date Format Options ===');
console.log('- Single date: YYYY-MM-DD (e.g., 2025-01-15)');
console.log('- Date range: YYYY-MM-DD to YYYY-MM-DD (e.g., 2025-01-15 to 2025-01-16)');
console.log('- No date: Omit the date parameter entirely'); 