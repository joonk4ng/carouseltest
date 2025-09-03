# URL Parameters Guide for CTR PWA

This guide explains how to use URL parameters to pre-fill the CTR (Crew Time Report) PWA with crew information and dates.

## Overview

The PWA supports URL parameters that allow you to pre-fill crew information and automatically select dates when the application loads. This is useful for creating bookmarks or sharing links with pre-filled data.

## Supported Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `crewName` | string | Name of the crew | `Dust+Busters+Plus` |
| `crewNumber` | string | Crew number/identifier | `C-75` |
| `fireName` | string | Name of the fire | `2025+RMA+Preposition` |
| `fireNumber` | string | Fire number/identifier | `CO-RMC-250002` |
| `date` | string | Date or date range | `2025-01-15` or `2025-01-15+to+2025-01-16` |
| `crewData` | JSON string | Array of crew members | See example below |

## Date Formats

The `date` parameter supports two formats:

### Single Date
- Format: `YYYY-MM-DD`
- Example: `2025-01-15`
- URL encoded: `2025-01-15`

### Date Range
- Format: `YYYY-MM-DD to YYYY-MM-DD`
- Example: `2025-01-15 to 2025-01-16`
- URL encoded: `2025-01-15+to+2025-01-16`

## Crew Data Format

The `crewData` parameter should be a JSON array of crew members, URL-encoded:

```json
[
  {
    "name": "Warren, Zachary Lee",
    "classification": "F1T"
  },
  {
    "name": "Hernandez, Isaac Raul",
    "classification": "FFT2"
  }
]
```

## Complete Examples

### Example 1: Your Current URL with Date Added
```
https://joonk4ng.github.io?crewName=Dust+Busters+Plus&crewNumber=C-75&fireName=2025+RMA+Preposition&fireNumber=CO-RMC-250002&date=2025-01-15&crewData=%5B%7B%22name%22%3A%22Warren%2C+Zachary+Lee%22%2C%22classification%22%3A%22F1T%22%7D%2C%7B%22name%22%3A%22Hernandez%2C+Isaac+Raul%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22French%2C+Luke+Christopher%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Rettig%2C+Jared+Michael%22%2C%22classification%22%3A%22CRWBT%22%7D%2C%7B%22name%22%3A%22Burchett%2C+Silas+Garret%22%2C%22classification%22%3A%22CRWB%22%7D%2C%7B%22name%22%3A%22White%2C+Austin+Taylor%22%2C%22classification%22%3A%22CRWBT%22%7D%2C%7B%22name%22%3A%22Bouchard%2C+Bryce+Alexander%22%2C%22classification%22%3A%22FFT1%22%7D%2C%7B%22name%22%3A%22Veneziali%2C+Robert+James%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Means%2C+Jacob++Otto%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Flinders%2C+Cameron+Dale%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Craig%2C+Dylan+James%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Gubler%2C+Kaymen+Sol%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Quarry%2C+Starrett+Lewis%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Studebaker%2C+Oliver+J%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Putzier%2C+Cameron+John+Paul%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Juarez%2C+Ruby%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Griffis%2C+Justin+Joseph%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Ammerman%2C+Brogan+Gooch%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Whelan%2C+Ethan+David+Ide%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Monreal%2C+Saul+Alexander%22%2C%22classification%22%3A%22FFT2%22%7D%2C%7B%22name%22%3A%22Monreal%2C+Saul+Alexander%22%2C%22classification%22%3A%22FFT2%22%7D%5D
```

### Example 2: Date Range without Crew Data
```
https://joonk4ng.github.io?crewName=Alpha+Crew&crewNumber=A1&fireName=Smith+Fire&fireNumber=2024-001&date=2024-01-15+to+2024-01-16
```

### Example 3: Basic Information Only (No Date)
```
https://joonk4ng.github.io?crewName=Bravo+Crew&crewNumber=B2&fireName=Johnson+Fire&fireNumber=2024-002
```

## URL Encoding

When creating URLs manually, remember to URL-encode special characters:

- Spaces: `+` or `%20`
- Commas: `%2C`
- Quotes: `%22`
- Square brackets: `%5B` and `%5D`
- Colons: `%3A`

## Validation Rules

The application validates URL parameters and will show error messages for:

- Invalid date formats
- Start date after end date (for date ranges)
- Invalid crew number format (letters, numbers, hyphens only)
- Invalid fire number format (letters, numbers, spaces, hyphens only)

## Behavior

When the application loads with URL parameters:

1. **Crew Information**: Automatically fills in crew name, number, fire name, and fire number
2. **Crew Members**: If `crewData` is provided, adds all crew members to the table
3. **Date Selection**: If `date` is provided, automatically selects that date/date range
4. **URL Cleanup**: After processing, the URL parameters are removed from the browser address bar

## Creating Links Programmatically

You can use the provided utility functions to create URLs programmatically:

```javascript
import { createCrewUrl } from './utils/urlParams';

const params = {
  crewName: 'Dust Busters Plus',
  crewNumber: 'C-75',
  fireName: '2025 RMA Preposition',
  fireNumber: 'CO-RMC-250002',
  date: '2025-01-15',
  crewData: JSON.stringify([
    { name: 'Warren, Zachary Lee', classification: 'F1T' },
    { name: 'Hernandez, Isaac Raul', classification: 'FFT2' }
  ])
};

const url = createCrewUrl(params);
console.log(url);
```

## Tips

1. **Single Date vs Date Range**: Use a single date for single-day operations, date range for multi-day operations
2. **Crew Data**: The `crewData` parameter is optional - you can pre-fill just the basic information
3. **Bookmarks**: Create bookmarks with URL parameters for frequently used crew configurations
4. **Sharing**: Share URLs with colleagues to quickly set up the same crew configuration

## Troubleshooting

- **Invalid Date Error**: Ensure dates are in YYYY-MM-DD format
- **Crew Data Not Loading**: Check that the JSON is properly URL-encoded
- **Parameters Not Working**: Verify that all special characters are properly encoded
- **Date Range Issues**: Ensure start date is before or equal to end date
