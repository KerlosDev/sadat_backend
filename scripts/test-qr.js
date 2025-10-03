const QRService = require('../services/qrService');

async function testQRGeneration() {
    try {
        // Test data
        const testData = JSON.stringify({
            type: 'student_attendance',
            studentId: '68dfeac38767b1a59ff3d5a8',
            studentNumber: 'STU000388',
            generatedAt: Date.now(),
            uniqueId: '1ca08731-edd2-48bf-896e-699631435545'
        });

        console.log('Test data:', testData);

        // Generate QR code
        const qrImage = await QRService.generateQRCodeBase64(testData);

        console.log('Generated QR code starts with:', qrImage.substring(0, 50));
        console.log('Is proper data URL?', qrImage.startsWith('data:image/png;base64,'));

        if (qrImage.startsWith('data:image/png;base64,')) {
            const base64Part = qrImage.split(',')[1];
            console.log('Base64 part starts with:', base64Part.substring(0, 20));
            console.log('Base64 part length:', base64Part.length);
        }

    } catch (error) {
        console.error('Test error:', error);
    }
}

testQRGeneration();