export async function generatePDF(data: any): Promise<Buffer> {
  try {
    const { jsPDF } = await import('jspdf');
    
    // Create PDF document with better layout
    const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 50;
    const usableWidth = pageWidth - (margin * 2);
    
    // Simplified header (no navigation as requested)
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PULSE DASHBOARD™', margin, 60);
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Analytics & Competitive Intelligence Report', margin, 85);
    
    let yPosition = 120;
    
    // Client info
    if (data.clientLabel) {
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(data.clientLabel, margin, yPosition);
      yPosition += 25;
    }
    
    const today = new Date();
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${today.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`, margin, yPosition);
    yPosition += 40;
    
    // Add actual dashboard data if available
    if (data.dashboardData && data.dashboardData.metrics) {
      const metrics = data.dashboardData.metrics;
      
      // Key Metrics Section
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('KEY PERFORMANCE METRICS', margin, yPosition);
      yPosition += 30;
      
      // Show key metrics with actual values
      const bounceRate = metrics.find((m: any) => m.metricName === 'Bounce Rate' && m.sourceType === 'Client');
      const sessionDuration = metrics.find((m: any) => m.metricName === 'Session Duration' && m.sourceType === 'Client');
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      
      if (bounceRate) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Bounce Rate:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${bounceRate.value}%`, margin + 100, yPosition);
        yPosition += 20;
      }
      
      if (sessionDuration) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Session Duration:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`${sessionDuration.value} seconds`, margin + 120, yPosition);
        yPosition += 20;
      }
      
      yPosition += 20;
      
      // Traffic Channels Section
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('TRAFFIC CHANNELS DISTRIBUTION', margin, yPosition);
      yPosition += 30;
      
      // Show traffic channel data
      const trafficChannels = metrics.filter((m: any) => m.metricName === 'Traffic Channels' && m.sourceType === 'Client');
      
      if (trafficChannels.length > 0) {
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        
        // Handle JSON format traffic data
        const clientTraffic = trafficChannels.find((m: any) => m.sourceType === 'Client');
        if (clientTraffic && typeof clientTraffic.value === 'string') {
          try {
            const channelArray = JSON.parse(clientTraffic.value);
            channelArray.sort((a: any, b: any) => b.percentage - a.percentage).slice(0, 6).forEach((channel: any) => {
              pdf.text(`${channel.channel}:`, margin, yPosition);
              pdf.text(`${channel.percentage.toFixed(1)}%`, margin + 150, yPosition);
              yPosition += 18;
            });
          } catch (e) {
            // Fall back to individual channel records
            const channels = trafficChannels
              .filter((m: any) => m.channel)
              .sort((a: any, b: any) => b.value - a.value)
              .slice(0, 6);
            
            channels.forEach((channel: any) => {
              pdf.text(`${channel.channel}:`, margin, yPosition);
              pdf.text(`${channel.value.toFixed(1)}%`, margin + 150, yPosition);
              yPosition += 18;
            });
          }
        }
      }
      
      yPosition += 20;
      
      // Device Distribution
      const deviceMetrics = metrics.filter((m: any) => m.metricName === 'Device Distribution' && m.sourceType === 'Client');
      if (deviceMetrics.length > 0) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('DEVICE DISTRIBUTION', margin, yPosition);
        yPosition += 30;
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'normal');
        
        deviceMetrics.forEach((device: any) => {
          pdf.text(`${device.deviceType || 'Unknown'}:`, margin, yPosition);
          pdf.text(`${device.value.toFixed(1)}%`, margin + 100, yPosition);
          yPosition += 18;
        });
        
        yPosition += 20;
      }
      
      // Check if we need a new page
      if (yPosition > pageHeight - 200) {
        pdf.addPage();
        yPosition = margin;
      }
      
      // AI Insights Section
      if (data.dashboardData.insights && data.dashboardData.insights.length > 0) {
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text('AI INSIGHTS', margin, yPosition);
        yPosition += 30;
        
        const insight = data.dashboardData.insights[0];
        if (insight) {
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text(insight.metricName, margin, yPosition);
          yPosition += 25;
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'normal');
          
          // Add context
          if (insight.contextText) {
            pdf.text('Context:', margin, yPosition);
            yPosition += 15;
            
            const contextLines = pdf.splitTextToSize(insight.contextText, usableWidth);
            contextLines.slice(0, 5).forEach((line: string) => {
              pdf.text(line, margin, yPosition);
              yPosition += 12;
            });
            yPosition += 10;
          }
          
          // Add recommendations
          if (insight.recommendationText) {
            pdf.text('Recommendations:', margin, yPosition);
            yPosition += 15;
            
            const recLines = pdf.splitTextToSize(insight.recommendationText, usableWidth);
            recLines.slice(0, 6).forEach((line: string) => {
              pdf.text(line, margin, yPosition);
              yPosition += 12;
            });
          }
        }
      }
    } else {
      // Fallback when no data
      pdf.setFontSize(14);
      pdf.text('Dashboard data is being loaded. Please try generating the PDF again.', margin, yPosition);
    }
    
    // Footer
    const footerY = pageHeight - 30;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Generated by Pulse Dashboard™ - Clear Digital Marketing Intelligence', margin, footerY);
    
    // Return PDF as buffer
    const pdfArrayBuffer = pdf.output('arraybuffer');
    return Buffer.from(pdfArrayBuffer);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`PDF generation failed: ${(error as Error).message}`);
  }
}

