import React, { useEffect, useState, useCallback } from 'react';
import '../styles/ThemeToggle.css';

type Theme = 'default' | 'colorblind' | 'high-contrast';

const THEME_STORAGE_KEY = 'preferred-theme';
const DEFAULT_THEME: Theme = 'default';
const VALID_THEMES = ['default', 'colorblind', 'high-contrast'] as const;

// Move isValidTheme outside the component
const isValidTheme = (value: unknown): value is Theme => {
  return typeof value === 'string' && VALID_THEMES.includes(value as Theme);
};

export const ThemeToggle: React.FC = () => {
  // Initialize theme from localStorage or default
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      // Check if we have a saved theme and it's valid
      if (savedTheme && isValidTheme(savedTheme)) {
        return savedTheme;
      }
      // If no saved theme or invalid, use default and clean up localStorage
      localStorage.setItem(THEME_STORAGE_KEY, DEFAULT_THEME);
      return DEFAULT_THEME;
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      return DEFAULT_THEME;
    }
  });

  // Apply theme to document
  const applyTheme = useCallback((newTheme: Theme) => {
    try {
      // Apply to html element
      document.documentElement.setAttribute('data-theme', newTheme);
      
      // Also apply to main container elements for redundancy
      const mainContainers = [
        document.querySelector('.App'),
        document.querySelector('.main-table-container'),
        document.querySelector('.ctr-container')
      ];

      mainContainers.forEach(container => {
        if (container) {
          container.setAttribute('data-theme', newTheme);
        }
      });

      // Save to localStorage
      try {
        localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch (storageError) {
        console.error('Error saving theme to localStorage:', storageError);
      }

      // Debug information
      console.group('Theme Application Status');
      console.log('Theme changed to:', newTheme);
      console.log('HTML element theme:', document.documentElement.getAttribute('data-theme'));
      console.log('Main containers found:', mainContainers.filter(Boolean).length);
      console.log('Local storage value:', localStorage.getItem(THEME_STORAGE_KEY));
      console.groupEnd();

    } catch (error) {
      console.error('Error applying theme:', error);
      // Try to recover by setting only on documentElement
      try {
        document.documentElement.setAttribute('data-theme', newTheme);
      } catch (fallbackError) {
        console.error('Critical error applying theme:', fallbackError);
      }
    }
  }, []);

  // Effect to apply theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Handle theme change
  const handleThemeChange = (newTheme: string) => {
    if (!isValidTheme(newTheme)) {
      console.error('Invalid theme selected:', newTheme);
      return;
    }
    setTheme(newTheme);
  };

  return (
    <div className="theme-toggle" data-theme={theme}>
      <label htmlFor="theme-select" className="theme-toggle-label">
        Accessibility Mode:
      </label>
      <select
        id="theme-select"
        value={theme}
        onChange={(e) => handleThemeChange(e.target.value)}
        className="theme-toggle-select"
      >
        {VALID_THEMES.map(themeOption => (
          <option key={themeOption} value={themeOption}>
            {themeOption === 'default' ? 'Default' :
             themeOption === 'colorblind' ? 'Colorblind-friendly' :
             'High Contrast'}
          </option>
        ))}
      </select>
      {process.env.NODE_ENV === 'development' && (
        <div className="theme-debug">
          Current theme: {theme}
        </div>
      )}
    </div>
  );
}; 