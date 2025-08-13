export async function generatePDF(data: any): Promise<Buffer> {
  try {
    // Import chart generation utilities
    const { 
      processTrafficChannels, 
      processDeviceDistribution, 
      processBounceRateComparison,
      generatePieChartSVG,
      generateBarChartSVG 
    } = await import('./utils/chart-generator.js');
    
    const { jsPDF } = await import('jspdf');
    
    // Create PDF document
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Simplified header (no navigation)
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PULSE DASHBOARD™', 50, 40);
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Analytics Report', 50, 60);
    
    // Client info in header
    let yPosition = 85;
    if (data.clientLabel) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(data.clientLabel, 50, yPosition);
      yPosition += 20;
    }
    
    const today = new Date();
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    })}`, 50, yPosition);
    yPosition += 30;
    
    // Process dashboard data and generate charts if available
    if (data.dashboardData && data.dashboardData.metrics) {
      const metrics = data.dashboardData.metrics;
      const competitors = data.dashboardData.competitors || [];
      
      // Key metrics summary
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('KEY METRICS', 50, yPosition);
      yPosition += 25;
      
      // Extract key metrics for display
      const bounceRate = metrics.find((m: any) => m.metricName === 'Bounce Rate' && m.sourceType === 'Client');
      const sessionDuration = metrics.find((m: any) => m.metricName === 'Session Duration' && m.sourceType === 'Client');
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      if (bounceRate) {
        pdf.text(`Bounce Rate: ${bounceRate.value}%`, 60, yPosition);
        yPosition += 18;
      }
      
      if (sessionDuration) {
        pdf.text(`Session Duration: ${sessionDuration.value}s`, 60, yPosition);
        yPosition += 18;
      }
      
      yPosition += 20;
      
      // Traffic Channels Chart
      const trafficData = processTrafficChannels(metrics);
      if (trafficData.data.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('TRAFFIC CHANNELS', 50, yPosition);
        yPosition += 25;
        
        const trafficSVG = generatePieChartSVG(trafficData, 450, 200);
        
        // Convert SVG to image and add to PDF
        try {
          // For now, add data as text until we can render SVG
          const topChannels = trafficData.data
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
            
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          topChannels.forEach(channel => {
            pdf.text(`${channel.label}: ${channel.value.toFixed(1)}%`, 60, yPosition);
            yPosition += 15;
          });
          
          yPosition += 20;
        } catch (e) {
          console.warn('Chart rendering skipped:', e);
          yPosition += 100;
        }
      }
      
      // Device Distribution
      const deviceData = processDeviceDistribution(metrics);
      if (deviceData.data.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DEVICE DISTRIBUTION', 50, yPosition);
        yPosition += 25;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        deviceData.data.forEach(device => {
          pdf.text(`${device.label}: ${device.value.toFixed(1)}%`, 60, yPosition);
          yPosition += 15;
        });
        
        yPosition += 20;
      }
      
      // Check if we need a new page
      if (yPosition > pageHeight - 150) {
        pdf.addPage();
        yPosition = 50;
      }
      
      // Competitor Bounce Rate Comparison
      const bounceComparisonData = processBounceRateComparison(metrics, competitors);
      if (bounceComparisonData.data.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('BOUNCE RATE COMPARISON', 50, yPosition);
        yPosition += 25;
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        bounceComparisonData.data.forEach(item => {
          pdf.text(`${item.label}: ${item.value.toFixed(2)}%`, 60, yPosition);
          yPosition += 15;
        });
        
        yPosition += 20;
      }
      
      // AI Insights section
      if (data.dashboardData.insights && data.dashboardData.insights.length > 0) {
        // Check if we need a new page for insights
        if (yPosition > pageHeight - 200) {
          pdf.addPage();
          yPosition = 50;
        }
        
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('AI INSIGHTS', 50, yPosition);
        yPosition += 25;
        
        // Add first insight as sample
        const insight = data.dashboardData.insights[0];
        if (insight) {
          pdf.setFontSize(12);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`${insight.metricName}`, 60, yPosition);
          yPosition += 20;
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          // Add context (truncated)
          const contextLines = pdf.splitTextToSize(insight.contextText || '', pageWidth - 120);
          contextLines.slice(0, 3).forEach((line: string) => {
            pdf.text(line, 60, yPosition);
            yPosition += 12;
          });
          
          yPosition += 10;
          
          // Add recommendations (truncated)
          if (insight.recommendationText) {
            pdf.setFont('helvetica', 'bold');
            pdf.text('Recommendations:', 60, yPosition);
            yPosition += 15;
            
            pdf.setFont('helvetica', 'normal');
            const recLines = pdf.splitTextToSize(insight.recommendationText, pageWidth - 120);
            recLines.slice(0, 4).forEach((line: string) => {
              pdf.text(line, 60, yPosition);
              yPosition += 12;
            });
          }
        }
      }
    } else {
      // Fallback content when no dashboard data
      pdf.setFontSize(12);
      pdf.text('Dashboard data not available for visualization.', 50, yPosition);
      yPosition += 20;
      pdf.text('Please ensure you are connected and try again.', 50, yPosition);
    }
    
    // Add footer
    const footerY = pageHeight - 30;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Generated by Pulse Dashboard™ - Clear Digital', 50, footerY);
    
    // Return as Buffer
    const pdfArrayBuffer = pdf.output('arraybuffer');
    return Buffer.from(pdfArrayBuffer);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${(error as Error).message}`);
  }
}