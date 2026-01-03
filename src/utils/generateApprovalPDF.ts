import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface JobDetails {
  work_order_num: number;
  unit_number: string;
  property: {
    name: string;
    address: string;
    address_2?: string;
    city: string;
    state: string;
    zip: string;
  };
}

interface ExtraChargesData {
  items: Array<{
    description: string;
    cost: number;
    hours?: number;
    quantity?: number;
    unit?: string;
  }>;
  total: number;
}

interface JobImage {
  id: string;
  file_path: string;
  file_name: string;
  image_type: string;
  public_url?: string;
}

interface GeneratePDFOptions {
  job: JobDetails;
  extraChargesData: ExtraChargesData;
  approverName?: string;
  approverEmail: string;
  images?: JobImage[];
  supabaseUrl?: string;
  approvedAt?: string;
  status: 'pending' | 'approved';
}

export async function generateApprovalPDF(options: GeneratePDFOptions): Promise<void> {
  const { 
    job, 
    extraChargesData, 
    approverName, 
    approverEmail, 
    images = [], 
    supabaseUrl,
    approvedAt,
    status
  } = options;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  // Add company header
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('JG Painting Pros Inc.', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Extra Charges Approval', pageWidth / 2, 25, { align: 'center' });

  yPosition = 45;

  // Status badge
  doc.setTextColor(0, 0, 0);
  if (status === 'approved') {
    doc.setFillColor(34, 197, 94); // Green-500
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(pageWidth - 60, yPosition, 50, 10, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('✓ APPROVED', pageWidth - 35, yPosition + 7, { align: 'center' });
  } else {
    doc.setFillColor(251, 191, 36); // Amber-400
    doc.setTextColor(0, 0, 0);
    doc.roundedRect(pageWidth - 60, yPosition, 50, 10, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PENDING', pageWidth - 35, yPosition + 7, { align: 'center' });
  }

  yPosition += 20;

  // Work Order Number
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Work Order: WO-${job.work_order_num.toString().padStart(6, '0')}`, 15, yPosition);
  yPosition += 10;

  // Property Details
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Property Details', 15, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Property: ${job.property.name}`, 15, yPosition);
  yPosition += 5;

  const propertyAddress = `${job.property.address}${
    job.property.address_2 ? `, ${job.property.address_2}` : ''
  }, ${job.property.city}, ${job.property.state} ${job.property.zip}`;
  doc.text(`Address: ${propertyAddress}`, 15, yPosition);
  yPosition += 5;

  doc.text(`Unit: ${job.unit_number}`, 15, yPosition);
  yPosition += 10;

  // Extra Charges Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Extra Charges', 15, yPosition);
  yPosition += 5;

  const tableData = extraChargesData.items.map(item => {
    const hasHours = typeof item.hours === 'number' && item.hours > 0;
    const hasQty = typeof item.quantity === 'number' && item.quantity > 0;
    const rate = hasHours
      ? item.cost / (item.hours as number)
      : hasQty
      ? item.cost / (item.quantity as number)
      : undefined;
    const qtyOrHrs = item.quantity
      ? `${item.quantity} (${item.unit || 'items'})`
      : (item.hours ? `${item.hours} hrs` : '-');
    const rateText = typeof rate === 'number'
      ? `$${rate.toFixed(2)}${hasHours ? '/hr' : ` per ${item.unit || 'item'}`}`
      : '-';
    return [
      item.description,
      qtyOrHrs,
      rateText,
      `$${item.cost.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY: yPosition,
    head: [['Description', 'Qty/Hrs', 'Rate', 'Amount']],
    body: tableData,
    foot: [['', '', 'Total:', `$${extraChargesData.total.toFixed(2)}`]],
    theme: 'striped',
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [229, 231, 235],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 11
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' }
    }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Approver Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Approver Information', 15, yPosition);
  yPosition += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${approverName || 'Not specified'}`, 15, yPosition);
  yPosition += 5;
  doc.text(`Email: ${approverEmail}`, 15, yPosition);
  yPosition += 5;

  if (approvedAt) {
    doc.text(`Approved: ${new Date(approvedAt).toLocaleString()}`, 15, yPosition);
    yPosition += 5;
  } else {
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, yPosition);
    yPosition += 5;
  }

  // Images section
  if (images && images.length > 0 && supabaseUrl) {
    yPosition += 10;
    
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Job Photos (${images.length})`, 15, yPosition);
    yPosition += 7;

    try {
      // Load images and add them to PDF
      const imagesPerRow = 2;
      const imageWidth = 80;
      const imageHeight = 80;
      const margin = 15;
      const spacing = 10;

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const col = i % imagesPerRow;
        const row = Math.floor(i / imagesPerRow);
        
        const xPosition = margin + col * (imageWidth + spacing);
        const currentYPosition = yPosition + row * (imageHeight + spacing + 10);

        // Check if we need a new page
        if (currentYPosition + imageHeight > 280) {
          doc.addPage();
          yPosition = 20;
          continue;
        }

        try {
          const imageUrl = image.public_url || `${supabaseUrl}/storage/v1/object/public/job-images/${image.file_path}`;
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          // Add image
          doc.addImage(dataUrl, 'JPEG', xPosition, currentYPosition, imageWidth, imageHeight);
          
          // Add label
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          const label = image.image_type || image.file_name;
          doc.text(label, xPosition + imageWidth / 2, currentYPosition + imageHeight + 5, { 
            align: 'center',
            maxWidth: imageWidth 
          });
        } catch (imgError) {
          console.error('Error loading image for PDF:', imgError);
          // Draw placeholder
          doc.setFillColor(229, 231, 235);
          doc.rect(xPosition, currentYPosition, imageWidth, imageHeight, 'F');
          doc.setTextColor(107, 114, 128);
          doc.text('Image unavailable', xPosition + imageWidth / 2, currentYPosition + imageHeight / 2, {
            align: 'center'
          });
        }
      }
    } catch (error) {
      console.error('Error adding images to PDF:', error);
    }
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(
      `JG Painting Pros Inc. • Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const fileName = `WO-${job.work_order_num.toString().padStart(6, '0')}-Extra-Charges-${status === 'approved' ? 'Approved' : 'Pending'}.pdf`;
  doc.save(fileName);
}
