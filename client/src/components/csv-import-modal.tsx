import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Check, X, AlertCircle, Search, ShieldCheck, TrendingUp, SkipForward, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CSVImportModalProps {
  /** Modal visibility state */
  open: boolean;
  /** Callback to control modal visibility */
  onOpenChange: (open: boolean) => void;
  /** Callback triggered after successful import completion */
  onImportComplete: () => void;
}

/** CSV file preview data structure for column mapping interface */
interface PreviewData {
  /** Extracted column headers from CSV file */
  headers: string[];
  /** Sample data rows for preview display (limited set) */
  preview: Record<string, string>[];
  /** Total number of rows in the CSV file */
  totalRows: number;
  /** Available target fields for column mapping */
  availableFields: string[];
}

/** Import operation results with comprehensive metrics */
interface ImportResults {
  /** Number of successfully imported records */
  imported: number;
  /** Number of duplicate rows that were skipped */
  skippedDuplicates: number;
  /** Number of invalid rows that were skipped */
  skippedInvalid: number;
  /** Number of failed import attempts */
  failed: number;
  /** Total number of rows processed */
  total: number;
  /** Detailed error messages for failed imports */
  errors: string[];
}

/** Validation results from the backend validation endpoint */
interface ValidationResults {
  /** Total number of rows analyzed */
  totalRows: number;
  /** Number of valid rows ready for import */
  validRows: number;
  /** Number of duplicate rows detected */
  duplicateRows: number;
  /** Number of invalid rows with errors */
  invalidRows: number;
  /** Whether import operation can proceed */
  canImport: boolean;
  /** Detailed validation data for each row */
  validation: {
    results: Array<{
      status: 'valid' | 'duplicate' | 'invalid';
      row: Record<string, string>;
      cleanedData?: Record<string, any>;
      duplicateMatch?: Record<string, any>;
      errors?: string[];
    }>;
  };
}

/** Field mapping configuration with user-friendly labels */
const fieldLabels: Record<string, string> = {
  name: "Company Name *",
  websiteUrl: "Website URL *", 
  industryVertical: "Industry Vertical *",
  businessSize: "Business Size *",
  sourceVerified: "Source Verified",
  active: "Active Status"
};

/**
 * Advanced CSV import modal with multi-step workflow and intelligent column mapping.
 * Provides comprehensive data import solution with file validation, preview generation,
 * interactive column mapping, and detailed import results with error handling.
 * 
 * Key features:
 * - Multi-step wizard workflow (Upload → Mapping → Importing → Results)
 * - CSV file validation and preview generation with sample data display
 * - Interactive column mapping interface with dropdown field selection
 * - Real-time import progress tracking with success/failure metrics
 * - Comprehensive error reporting with detailed failure reasons
 * - Field validation with required field enforcement
 * - Bulk data processing with batch import capabilities
 * - User-friendly interface with step-by-step guidance
 * - Responsive design optimized for data management workflows
 * - Toast notification integration for immediate user feedback
 * 
 * The modal integrates with backend data processing pipeline for
 * company data ingestion and portfolio management system integration.
 * 
 * @param open - Controls modal visibility state
 * @param onOpenChange - Handler for modal visibility changes
 * @param onImportComplete - Callback for successful import completion
 */
export function CSVImportModal({ open, onOpenChange, onImportComplete }: CSVImportModalProps) {
  /** Current step in the import workflow process */
  const [step, setStep] = useState<'upload' | 'mapping' | 'validation' | 'importing' | 'results'>('upload');
  /** Currently selected CSV file for processing */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  /** Parsed CSV data with headers and preview rows */
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  /** User-defined mapping from CSV columns to target fields */
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  /** Final import operation results and metrics */
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  /** Validation results from pre-import validation check */
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);
  /** Loading state for async operations (file processing, import) */
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Handles CSV file selection with validation.
   * Ensures only CSV files are accepted and updates file state.
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please select a CSV file.",
        variant: "destructive",
      });
    }
  };

  /**
   * Processes CSV file for preview and generates intelligent column mappings.
   * Uploads file to backend for parsing, extracts headers and sample data,
   * then creates smart default mappings based on column name patterns.
   */
  const handlePreview = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);

      const response = await fetch('/api/admin/benchmark-companies/csv-preview', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to preview CSV');
      }

      const data = await response.json();
      setPreviewData(data);
      
      // Intelligent column mapping with pattern-based field detection
      const initialMapping: Record<string, string> = {};
      data.availableFields.forEach((field: string) => {
        const matchingHeader = data.headers.find((header: string) => 
          header.toLowerCase().includes(field.toLowerCase()) ||
          (field === 'websiteUrl' && header.toLowerCase().includes('website')) ||
          (field === 'industryVertical' && header.toLowerCase().includes('industry')) ||
          (field === 'businessSize' && header.toLowerCase().includes('size'))
        );
        if (matchingHeader) {
          initialMapping[field] = matchingHeader;
        }
      });
      setColumnMapping(initialMapping);
      
      setStep('mapping');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to preview CSV file. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Validates CSV data before import with comprehensive duplicate detection.
   * Calls the backend validation endpoint to analyze data quality, detect duplicates,
   * and provide detailed feedback on import readiness.
   */
  const handleValidation = async () => {
    if (!selectedFile || !previewData) return;

    // Validate required field mappings before sending to backend
    const requiredFields = ['name', 'websiteUrl', 'industryVertical', 'businessSize'];
    const missingMappings = requiredFields.filter(field => !columnMapping[field]);
    
    if (missingMappings.length > 0) {
      toast({
        title: "Missing required mappings",
        description: `Please map the following required fields: ${missingMappings.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);
      formData.append('columnMapping', JSON.stringify(columnMapping));

      const response = await fetch('/api/admin/benchmark-companies/csv-validate', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to validate CSV');
      }

      const data = await response.json();
      setValidationResults(data.data);
      setStep('validation');
      
      toast({
        title: "Validation Complete",
        description: data.message,
        variant: data.data.canImport ? "default" : "destructive",
      });
    } catch (error) {
      toast({
        title: "Validation failed",
        description: "Failed to validate CSV data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Executes CSV data import with comprehensive validation and error handling.
   * Uses the validated data and processes through backend pipeline.
   */
  const handleImport = async () => {
    if (!selectedFile || !validationResults) return;

    if (!validationResults.canImport) {
      toast({
        title: "Cannot import",
        description: "Please resolve validation issues before importing.",
        variant: "destructive",
      });
      return;
    }

    setStep('importing');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('csvFile', selectedFile);
      formData.append('columnMapping', JSON.stringify(columnMapping));

      const response = await fetch('/api/admin/benchmark-companies/csv-import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to import CSV');
      }

      const data = await response.json();
      const results = data.data || data.results || {};
      const imported = results.imported || 0;
      const skippedDuplicates = results.skippedDuplicates || 0;
      const skippedInvalid = results.skippedInvalid || 0;
      const failed = results.failed || 0;
      
      setImportResults({
        imported,
        skippedDuplicates,
        skippedInvalid,
        failed,
        total: results.total || (imported + skippedDuplicates + skippedInvalid + failed),
        errors: results.errors || []
      });
      setStep('results');
      
      // Trigger completion callback for successful imports
      if (results.imported > 0) {
        onImportComplete();
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import CSV data. Please try again.",
        variant: "destructive",
      });
      setStep('validation');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resets modal state and closes the dialog.
   * Clears all form data, step progression, and temporary state.
   */
  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewData(null);
    setColumnMapping({});
    setImportResults(null);
    setValidationResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Benchmark Companies from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file and map the columns to import benchmark company data.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <span className="text-lg font-medium">Choose CSV file</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Maximum file size: 5MB
                  </p>
                </Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="mt-2 hidden"
                />
              </div>
              {selectedFile && (
                <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>{selectedFile.name} ({Math.round(selectedFile.size / 1024)}KB)</span>
                </div>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Required CSV Format:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Headers in the first row</li>
                <li>• Required columns: Company Name, Website URL, Industry Vertical, Business Size</li>
                <li>• Optional columns: Source Verified (true/false), Active Status (true/false)</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'mapping' && previewData && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Map CSV Columns to Database Fields</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previewData.availableFields.map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>{fieldLabels[field] || field}</Label>
                    <Select
                      value={columnMapping[field] || '__none__'}
                      onValueChange={(value) => setColumnMapping(prev => ({ 
                        ...prev, 
                        [field]: value === '__none__' ? '' : value 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select CSV column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {previewData.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preview Data ({previewData.totalRows} total rows)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        {previewData.headers.map((header) => (
                          <th key={header} className="text-left p-2 font-medium">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview.map((row, index) => (
                        <tr key={index} className="border-b">
                          {previewData.headers.map((header) => (
                            <td key={header} className="p-2">
                              {row[header]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'validation' && validationResults && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <span>Validation Results</span>
              </h3>
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{validationResults.validRows}</div>
                    <div className="text-sm text-gray-500">Valid Rows</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-orange-600">{validationResults.duplicateRows}</div>
                    <div className="text-sm text-gray-500">Duplicates</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{validationResults.invalidRows}</div>
                    <div className="text-sm text-gray-500">Invalid</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-blue-600">{validationResults.totalRows}</div>
                    <div className="text-sm text-gray-500">Total Rows</div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Import Readiness Status */}
              <div className={`p-4 rounded-lg mb-6 ${
                validationResults.canImport 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center space-x-2">
                  {validationResults.canImport ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-red-600" />
                  )}
                  <span className={`font-medium ${
                    validationResults.canImport ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {validationResults.canImport 
                      ? `Ready to import ${validationResults.validRows} valid rows` 
                      : 'Cannot import - please resolve validation issues'
                    }
                  </span>
                </div>
                
                {!validationResults.canImport && validationResults.validRows === 0 && (
                  <p className="text-sm text-red-700 mt-2">
                    No valid rows found. Please check your data and column mappings.
                  </p>
                )}
                
                {validationResults.duplicateRows > 0 && (
                  <p className="text-sm text-orange-700 mt-2">
                    {validationResults.duplicateRows} duplicate rows will be skipped during import.
                  </p>
                )}
              </div>
            </div>

            {/* Detailed Results Table */}
            {validationResults.validation && validationResults.validation.results && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Row-by-Row Validation Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <div className="space-y-2">
                      {validationResults.validation.results.map((result, index) => (
                        <div 
                          key={index} 
                          className={`p-3 rounded-lg border ${
                            result.status === 'valid' 
                              ? 'border-green-200 bg-green-50' 
                              : result.status === 'duplicate'
                              ? 'border-orange-200 bg-orange-50'
                              : 'border-red-200 bg-red-50'
                          }`}
                          data-testid={`validation-row-${index}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              {result.status === 'valid' && <Check className="h-4 w-4 text-green-600" />}
                              {result.status === 'duplicate' && <AlertCircle className="h-4 w-4 text-orange-600" />}
                              {result.status === 'invalid' && <X className="h-4 w-4 text-red-600" />}
                              <span className={`text-sm font-medium capitalize ${
                                result.status === 'valid' ? 'text-green-800'
                                : result.status === 'duplicate' ? 'text-orange-800'
                                : 'text-red-800'
                              }`}>
                                {result.status}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">Row {index + 1}</span>
                          </div>
                          
                          <div className="mt-2 text-sm text-gray-700">
                            <strong>Company:</strong> {(() => {
                              // Find the CSV header that maps to the 'name' field
                              const nameHeader = Object.entries(columnMapping).find(([field, header]) => field === 'name')?.[1];
                              return nameHeader ? result.row[nameHeader] || 'N/A' : 'N/A';
                            })()} 
                            {(() => {
                              // Find the CSV header that maps to the 'websiteUrl' field
                              const urlHeader = Object.entries(columnMapping).find(([field, header]) => field === 'websiteUrl')?.[1];
                              return urlHeader && result.row[urlHeader] ? (
                                <> | <strong>URL:</strong> {result.row[urlHeader]}</>
                              ) : null;
                            })()}
                          </div>
                          
                          {result.status === 'duplicate' && result.duplicateMatch && (
                            <div className="mt-2 p-2 bg-orange-100 rounded text-sm">
                              <strong>Matches existing:</strong> {result.duplicateMatch.name}
                              {result.duplicateMatch.websiteUrl && (
                                <> ({result.duplicateMatch.websiteUrl})</>
                              )}
                            </div>
                          )}
                          
                          {result.status === 'invalid' && result.errors && result.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {result.errors.map((error, errorIndex) => (
                                <div key={errorIndex} className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                                  {error}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Importing data...</p>
            <p className="text-sm text-gray-500">Please wait while we process your CSV file.</p>
          </div>
        )}

        {step === 'results' && importResults && (
          <div className="space-y-6">
            {/* Results Header */}
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                {importResults.imported === importResults.total && importResults.failed === 0 ? (
                  <Check className="h-8 w-8 text-green-500" />
                ) : importResults.imported > 0 ? (
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                ) : (
                  <X className="h-8 w-8 text-red-500" />
                )}
                <h3 className="text-lg font-medium">Import Complete</h3>
              </div>
              
              {/* Status Message */}
              <div className={`p-4 rounded-lg mb-6 ${
                importResults.imported === importResults.total && importResults.failed === 0
                  ? 'bg-green-50 border border-green-200'
                  : importResults.imported > 0
                  ? 'bg-orange-50 border border-orange-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className={`font-medium ${
                  importResults.imported === importResults.total && importResults.failed === 0
                    ? 'text-green-800'
                    : importResults.imported > 0
                    ? 'text-orange-800'
                    : 'text-red-800'
                }`}>
                  {importResults.imported === importResults.total && importResults.failed === 0 ? (
                    `All ${importResults.imported} companies imported successfully!`
                  ) : importResults.imported > 0 ? (
                    `${importResults.imported} of ${importResults.total} companies imported successfully. ${importResults.skippedDuplicates + importResults.skippedInvalid + importResults.failed} rows had issues.`
                  ) : (
                    'No companies were imported. Please fix errors and try again.'
                  )}
                </div>
                
                {importResults.skippedDuplicates > 0 && (
                  <p className="text-sm text-orange-700 mt-2">
                    {importResults.skippedDuplicates} duplicate companies were skipped.
                  </p>
                )}
                
                {importResults.skippedInvalid > 0 && (
                  <p className="text-sm text-red-700 mt-2">
                    {importResults.skippedInvalid} rows had validation errors and were skipped.
                  </p>
                )}
              </div>
            </div>
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card data-testid="card-imported">
                <CardContent className="pt-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-600 uppercase tracking-wide">Imported</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{importResults.imported}</div>
                  <div className="text-sm text-gray-500">Companies added</div>
                </CardContent>
              </Card>
              
              {importResults.skippedDuplicates > 0 && (
                <Card data-testid="card-duplicates">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <SkipForward className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">Duplicates</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{importResults.skippedDuplicates}</div>
                    <div className="text-sm text-gray-500">Already exist</div>
                  </CardContent>
                </Card>
              )}
              
              {importResults.skippedInvalid > 0 && (
                <Card data-testid="card-invalid">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium text-red-600 uppercase tracking-wide">Invalid</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{importResults.skippedInvalid}</div>
                    <div className="text-sm text-gray-500">Validation errors</div>
                  </CardContent>
                </Card>
              )}
              
              {importResults.failed > 0 && (
                <Card data-testid="card-failed">
                  <CardContent className="pt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <X className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium text-red-600 uppercase tracking-wide">Failed</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                    <div className="text-sm text-gray-500">Import errors</div>
                  </CardContent>
                </Card>
              )}
              
              <Card data-testid="card-total">
                <CardContent className="pt-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Total</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{importResults.total}</div>
                  <div className="text-sm text-gray-500">Rows processed</div>
                </CardContent>
              </Card>
            </div>
            
            {/* Progress Visualization */}
            {importResults.total > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Import Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Success Rate Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Success Rate</span>
                        <span>{Math.round((importResults.imported / importResults.total) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(importResults.imported / importResults.total) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {/* Breakdown */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-600">✓ Imported:</span>
                        <span className="font-medium">{importResults.imported}</span>
                      </div>
                      {importResults.skippedDuplicates > 0 && (
                        <div className="flex justify-between">
                          <span className="text-orange-600">⚠ Duplicates:</span>
                          <span className="font-medium">{importResults.skippedDuplicates}</span>
                        </div>
                      )}
                      {importResults.skippedInvalid > 0 && (
                        <div className="flex justify-between">
                          <span className="text-red-600">✗ Invalid:</span>
                          <span className="font-medium">{importResults.skippedInvalid}</span>
                        </div>
                      )}
                      {importResults.failed > 0 && (
                        <div className="flex justify-between">
                          <span className="text-red-600">🚫 Failed:</span>
                          <span className="font-medium">{importResults.failed}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error Details */}
            {importResults.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-600 flex items-center space-x-2">
                    <X className="h-4 w-4" />
                    <span>Import Errors ({importResults.errors.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {importResults.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 flex items-start space-x-2 bg-red-50 p-2 rounded">
                        <X className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Next Steps */}
            {importResults.imported > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-green-600">Next Steps</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setStep('upload');
                        setSelectedFile(null);
                        setPreviewData(null);
                        setColumnMapping({});
                        setImportResults(null);
                        setValidationResults(null);
                      }}
                      data-testid="button-import-more"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import More Companies
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.location.href = '/admin-panel'}
                      data-testid="button-view-companies"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View All Companies
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={!selectedFile || isLoading}>
                {isLoading ? "Processing..." : "Preview & Map"}
              </Button>
            </>
          )}
          
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')} data-testid="button-back-upload">
                Back
              </Button>
              <Button onClick={handleValidation} disabled={isLoading} data-testid="button-validate">
                {isLoading ? "Validating..." : "Validate Data"}
              </Button>
            </>
          )}
          
          {step === 'validation' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')} data-testid="button-back-mapping">
                Back to Mapping
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!validationResults?.canImport || isLoading}
                data-testid="button-import-validated"
              >
                {isLoading ? "Importing..." : `Import ${validationResults?.validRows || 0} Valid Rows`}
              </Button>
            </>
          )}
          
          {step === 'results' && (
            <Button onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}