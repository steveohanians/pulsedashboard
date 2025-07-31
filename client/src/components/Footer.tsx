export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Copyright */}
        <div className="text-center mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-gray-600">
            © {currentYear} Clear Digital, Inc. All rights reserved.
          </p>
        </div>

        {/* Disclaimer */}
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4 lg:p-6">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-800 mb-2 sm:mb-3">Disclaimer</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            The metrics and rankings presented herein are compiled from multiple third-party sources. 
            These figures are provided "as-is" for general benchmarking purposes and are not guaranteed 
            to be complete, reliable, or error‐free. Clear Digital and its data providers make no 
            warranties—express or implied—regarding the accuracy, timeliness, or suitability of this 
            information. Users should verify critical insights against their own analytics before making decisions.
          </p>
        </div>
      </div>
    </footer>
  );
}