// pdfjskit type declaration
declare module 'pdfjskit' {
  interface PdfViewerOptions {
    documentUrl: string;
    width?: string | number;
    height?: string | number;
    resizable?: boolean;
    theme?: string;
    language?: string;
    toolbarVisible?: boolean;
    sidebarVisible?: boolean;
    verticalToolbarVisible?: boolean;
    permissions?: {
      viewAnnotations?: boolean;
      editAnnotations?: boolean;
      fillForms?: boolean;
      selectText?: boolean;
      rotate?: boolean;
      save?: boolean;
      print?: boolean;
      downloadOriginal?: boolean;
      open?: boolean;
    };
    events?: {
      documentLoaded?: () => void;
      failed?: (error: any) => void;
    };
  }

  // pdf viewer class
  class PdfViewer {
    constructor(options: PdfViewerOptions);
    render(container: HTMLElement): void;
    destroy(): void;
  }

  // export the pdf viewer
  export default PdfViewer;
} 