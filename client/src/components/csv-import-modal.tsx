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
import { Upload, FileText, Check, X, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CSVImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface PreviewData {
  headers: string[];
  preview: Record<string, string>[];
  totalRows: number;
  availableFields: string[];
}

interface ImportResults {
  successful: number;
  failed: number;
  errors: string[];
}

const fieldLabels: Record<string, string> = {
  name: "Company Name *",
  websiteUrl: "Website URL *", 
  industryVertical: "Industry Vertical *",
  businessSize: "Business Size *",
  sourceVerified: "Source Verified",
  active: "Active Status"
};

export function CSVImportModal({ open, onOpenChange, onImportComplete }: CSVImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'results'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
      
      // Initialize column mapping with smart defaults
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

  const handleImport = async () => {
    if (!selectedFile || !previewData) return;

    // Validate required mappings
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
      setImportResults(data.results);
      setStep('results');
      
      if (data.results.successful > 0) {
        onImportComplete();
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Failed to import CSV data. Please try again.",
        variant: "destructive",
      });
      setStep('mapping');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewData(null);
    setColumnMapping({});
    setImportResults(null);
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

        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-lg">Importing data...</p>
            <p className="text-sm text-gray-500">Please wait while we process your CSV file.</p>
          </div>
        )}

        {step === 'results' && importResults && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                {importResults.failed === 0 ? (
                  <Check className="h-8 w-8 text-green-500" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-orange-500" />
                )}
                <h3 className="text-lg font-medium">Import Complete</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{importResults.successful}</div>
                    <div className="text-sm text-gray-500">Successful</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{importResults.failed}</div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {importResults.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-red-600">Import Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {importResults.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 flex items-start space-x-2">
                        <X className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    ))}
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
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport}>
                Import Data
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