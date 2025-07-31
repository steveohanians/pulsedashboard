import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start mb-3 sm:mb-4 gap-2 sm:gap-3">
            <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 flex-shrink-0" />
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 text-center sm:text-left">404 Page Not Found</h1>
          </div>

          <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600 text-center sm:text-left">
            Did you forget to add the page to the router?
          </p>
        </CardContent>
      </Card>
      <Footer />
    </div>
  );
}
