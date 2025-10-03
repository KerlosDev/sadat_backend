const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

class QRService {
    // Generate unique QR code data for a student
    static generateStudentQRData(studentId, studentNumber) {
        const timestamp = Date.now();
        const uniqueId = uuidv4();

        return JSON.stringify({
            type: 'student_attendance',
            studentId,
            studentNumber,
            generatedAt: timestamp,
            uniqueId,
        });
    }

    // Generate QR code as base64 string
    static async generateQRCodeBase64(data) {
        try {
            const qrCodeDataURL = await QRCode.toDataURL(data, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            return qrCodeDataURL;
        } catch (error) {
            throw new Error('Failed to generate QR code: ' + error.message);
        }
    }

    // Generate QR code as buffer for file saving
    static async generateQRCodeBuffer(data) {
        try {
            const qrCodeBuffer = await QRCode.toBuffer(data, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            return qrCodeBuffer;
        } catch (error) {
            throw new Error('Failed to generate QR code buffer: ' + error.message);
        }
    }

    // Parse QR code data
    static parseQRData(qrData) {
        try {
            const parsedData = JSON.parse(qrData);

            if (parsedData.type !== 'student_attendance') {
                throw new Error('Invalid QR code type');
            }

            return parsedData;
        } catch (error) {
            throw new Error('Invalid QR code data: ' + error.message);
        }
    }

    // Validate QR code (check if it's not too old, etc.)
    static validateQRCode(parsedData) {
        const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
        const currentTime = Date.now();
        const qrAge = currentTime - parsedData.generatedAt;

        if (qrAge > maxAge) {
            throw new Error('QR code has expired');
        }

        return true;
    }

    // Complete QR code generation for a student
    static async generateStudentQRCode(studentId, studentNumber, format = 'base64') {
        const qrData = this.generateStudentQRData(studentId, studentNumber);

        if (format === 'base64') {
            return {
                data: qrData,
                image: await this.generateQRCodeBase64(qrData)
            };
        } else if (format === 'buffer') {
            return {
                data: qrData,
                buffer: await this.generateQRCodeBuffer(qrData)
            };
        } else {
            throw new Error('Invalid format. Use "base64" or "buffer"');
        }
    }
}

module.exports = QRService;