const { Student, Group, Department, Attendance } = require('../models');
const { validationResult } = require('express-validator');
const QRService = require('../services/qrService');
const { v4: uuidv4 } = require('uuid');

class StudentController {
    // Get all students
    static async getAllStudents(req, res) {
        try {
            const { page = 1, limit = 10, search = '', department = '', group = '', year = '' } = req.query;

            const query = {};

            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { studentNumber: { $regex: search, $options: 'i' } }
                ];
            }

            if (department) query.department = department;
            if (group) query.group = group;
            if (year) query.year = parseInt(year);

            const students = await Student.find(query)
                .populate('department', 'name code')
                .populate('group', 'name code')
                .select('-password -qrCode')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ name: 1 });

            const total = await Student.countDocuments(query);

            res.json({
                success: true,
                data: students,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            });
        } catch (error) {
            console.error('Get students error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching students'
            });
        }
    }

    // Get student by ID
    static async getStudentById(req, res) {
        try {
            const student = await Student.findById(req.params.id)
                .populate('department', 'name code')
                .populate('group', 'name code')
                .select('-password');

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            res.json({
                success: true,
                data: student
            });
        } catch (error) {
            console.error('Get student error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching student'
            });
        }
    }

    // Create new student
    static async createStudent(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, email, password, year, department, group, profile = {} } = req.body;

            // Check if student already exists
            const existingStudent = await Student.findOne({ email });
            if (existingStudent) {
                return res.status(409).json({
                    success: false,
                    message: 'Student with this email already exists'
                });
            }

            // Generate unique student number
            const studentNumber = `STU${Date.now()}`;

            // Create student first without QR code
            const student = new Student({
                name,
                email,
                password,
                studentNumber,
                year,
                department,
                group,
                profile
            });

            await student.save();

            // Generate QR code with actual student ID
            const qrData = QRService.generateStudentQRData(student._id, studentNumber);
            student.qrCode = qrData; // Store JSON data, not base64 image
            await student.save();

            // Populate and return
            const populatedStudent = await Student.findById(student._id)
                .populate('department', 'name code')
                .populate('group', 'name code')
                .select('-password -qrCode');

            res.status(201).json({
                success: true,
                message: 'Student created successfully',
                data: populatedStudent
            });
        } catch (error) {
            console.error('Create student error:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating student'
            });
        }
    }

    // Update student
    static async updateStudent(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { name, email, year, department, group, profile, isActive } = req.body;

            // Check if another student exists with the same email
            const existingStudent = await Student.findOne({
                $and: [
                    { _id: { $ne: req.params.id } },
                    { email }
                ]
            });

            if (existingStudent) {
                return res.status(409).json({
                    success: false,
                    message: 'Another student with this email already exists'
                });
            }

            const updateData = {
                name,
                email,
                year,
                department,
                group,
                profile,
                ...(isActive !== undefined && { isActive })
            };

            const student = await Student.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            )
                .populate('department', 'name code')
                .populate('group', 'name code')
                .select('-password -qrCode');

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            res.json({
                success: true,
                message: 'Student updated successfully',
                data: student
            });
        } catch (error) {
            console.error('Update student error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating student'
            });
        }
    }

    // Delete student
    static async deleteStudent(req, res) {
        try {
            const student = await Student.findById(req.params.id);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            // Delete associated attendance records
            await Attendance.deleteMany({ student: req.params.id });

            await Student.findByIdAndDelete(req.params.id);

            res.json({
                success: true,
                message: 'Student deleted successfully'
            });
        } catch (error) {
            console.error('Delete student error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting student'
            });
        }
    }

    // Get student QR code
    static async getStudentQRCode(req, res) {
        try {
            const student = await Student.findById(req.params.id).select('qrCode studentNumber name');

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            // Check authorization - students can only access their own QR code
            if (req.user.role === 'student' && req.user.id !== req.params.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Generate QR code image
            const qrCodeImage = await QRService.generateQRCodeBase64(student.qrCode);

            res.json({
                success: true,
                data: {
                    studentName: student.name,
                    studentNumber: student.studentNumber,
                    qrCodeData: student.qrCode,
                    qrCodeImage: qrCodeImage
                }
            });
        } catch (error) {
            console.error('Get QR code error:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating QR code'
            });
        }
    }

    // Get student attendance history
    static async getStudentAttendance(req, res) {
        try {
            const { startDate, endDate, page = 1, limit = 20 } = req.query;

            const query = { student: req.params.id };

            if (startDate || endDate) {
                query.lectureDate = {};
                if (startDate) query.lectureDate.$gte = new Date(startDate);
                if (endDate) query.lectureDate.$lte = new Date(endDate);
            }

            const attendance = await Attendance.find(query)
                .populate('group', 'name code')
                .populate('doctor', 'name profile.title')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ lectureDate: -1 });

            const total = await Attendance.countDocuments(query);

            // Calculate attendance statistics
            const stats = await Attendance.aggregate([
                { $match: { student: student._id } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const statsObj = stats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {});

            const totalLectures = stats.reduce((sum, stat) => sum + stat.count, 0);
            const presentCount = statsObj.present || 0;
            const attendancePercentage = totalLectures > 0 ? (presentCount / totalLectures) * 100 : 0;

            res.json({
                success: true,
                data: attendance,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                },
                statistics: {
                    total: totalLectures,
                    present: presentCount,
                    absent: statsObj.absent || 0,
                    late: statsObj.late || 0,
                    excused: statsObj.excused || 0,
                    attendancePercentage: Math.round(attendancePercentage * 100) / 100
                }
            });
        } catch (error) {
            console.error('Get student attendance error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching attendance history'
            });
        }
    }

    // Get current student's QR code
    static async getMyQRCode(req, res) {
        try {
            const student = await Student.findById(req.user.id).select('qrCode studentNumber name');

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            let qrCodeData = student.qrCode;
            let qrCodeImage;

            // Check if qrCode is base64 image or JSON data
            if (student.qrCode && student.qrCode.startsWith('data:image/')) {
                // It's a base64 image, extract the data from it
                // This is for backwards compatibility
                qrCodeData = JSON.stringify({
                    type: 'student_attendance',
                    studentId: student._id,
                    studentNumber: student.studentNumber,
                    generatedAt: Date.now(),
                    uniqueId: uuidv4()
                });
                qrCodeImage = student.qrCode;
            } else {
                // It's JSON data (preferred format)
                qrCodeData = student.qrCode;

                // Parse and validate the JSON data
                try {
                    const parsedData = JSON.parse(qrCodeData);

                    // If studentId is null or missing, regenerate the QR code data
                    if (!parsedData.studentId || parsedData.studentId === 'temp_id') {
                        qrCodeData = QRService.generateStudentQRData(student._id, student.studentNumber);

                        // Update the database with correct QR code data
                        await Student.findByIdAndUpdate(student._id, { qrCode: qrCodeData });
                    }
                } catch (parseError) {
                    // If parsing fails, generate new QR code data
                    qrCodeData = QRService.generateStudentQRData(student._id, student.studentNumber);
                    await Student.findByIdAndUpdate(student._id, { qrCode: qrCodeData });
                }

                // Generate the base64 image from the JSON data
                qrCodeImage = await QRService.generateQRCodeBase64(qrCodeData);
            }

            res.json({
                success: true,
                data: {
                    studentName: student.name,
                    studentNumber: student.studentNumber,
                    qrCodeData: qrCodeData,
                    qrCodeImage: qrCodeImage
                }
            });

            // Debug logging
            console.log('QR Code Response for student:', student.studentNumber);
            console.log('qrCodeData type:', typeof qrCodeData);
            console.log('qrCodeData starts with:', qrCodeData.substring(0, 50));
            console.log('qrCodeImage type:', typeof qrCodeImage);
            console.log('qrCodeImage starts with:', qrCodeImage.substring(0, 50));
        } catch (error) {
            console.error('Get my QR code error:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating QR code'
            });
        }
    }

    // Get student profile with QR code and attendance
    static async getStudentProfile(req, res) {
        try {
            const student = await Student.findById(req.params.id)
                .populate('department', 'name code')
                .populate('group', 'name code')
                .select('-password');

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            // Get recent attendance records
            const attendance = await Attendance.find({ student: req.params.id })
                .populate('session', 'subject date startTime endTime')
                .populate('session.doctor', 'name')
                .sort({ createdAt: -1 })
                .limit(10);

            // Calculate attendance statistics
            const totalSessions = await Attendance.countDocuments({ student: req.params.id });
            const attendedSessions = await Attendance.countDocuments({
                student: req.params.id,
                status: 'present'
            });
            const attendancePercentage = totalSessions > 0 ? (attendedSessions / totalSessions * 100).toFixed(1) : 0;

            res.json({
                success: true,
                data: {
                    student,
                    attendance,
                    statistics: {
                        totalSessions,
                        attendedSessions,
                        attendancePercentage
                    }
                }
            });
        } catch (error) {
            console.error('Get student profile error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching student profile'
            });
        }
    }

    // Regenerate student QR code
    static async regenerateQRCode(req, res) {
        try {
            const student = await Student.findById(req.params.id);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            // Generate new QR code
            const qrData = QRService.generateStudentQRData(student._id, student.studentNumber);
            student.qrCode = qrData;
            await student.save();

            res.json({
                success: true,
                message: 'QR code regenerated successfully'
            });
        } catch (error) {
            console.error('Regenerate QR code error:', error);
            res.status(500).json({
                success: false,
                message: 'Error regenerating QR code'
            });
        }
    }
}

module.exports = StudentController;