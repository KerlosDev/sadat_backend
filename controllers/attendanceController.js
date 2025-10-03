const { Attendance, Student, Group, Doctor } = require('../models');
const { validationResult } = require('express-validator');
const QRService = require('../services/qrService');
const mongoose = require('mongoose');

class AttendanceController {
    // Scan QR code and record attendance
    static async scanQRCode(req, res) {
        try {
            const { qrData, groupId, lectureDetails = {} } = req.body;

            if (!qrData || !groupId) {
                return res.status(400).json({
                    success: false,
                    message: 'QR data and group ID are required'
                });
            }

            // Parse and validate QR code
            let parsedQRData;
            try {
                parsedQRData = QRService.parseQRData(qrData);
                QRService.validateQRCode(parsedQRData);
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }

            // Find the student
            const student = await Student.findById(parsedQRData.studentId)
                .populate('group', '_id name')
                .populate('department', '_id name');

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            if (!student.isActive) {
                return res.status(400).json({
                    success: false,
                    message: 'Student account is inactive'
                });
            }

            // Verify student belongs to the group
            if (student.group._id.toString() !== groupId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student does not belong to this group'
                });
            }

            // Check if doctor is assigned to this group
            const doctor = await Doctor.findById(req.user.id);
            if (req.user.role === 'doctor' && !doctor.assignedGroups.includes(groupId)) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not assigned to this group'
                });
            }

            // Check if attendance already recorded for today
            const today = new Date();
            const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

            const existingAttendance = await Attendance.findOne({
                student: student._id,
                group: groupId,
                lectureDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            });

            if (existingAttendance) {
                return res.status(409).json({
                    success: false,
                    message: 'Attendance already recorded for this student today',
                    data: existingAttendance
                });
            }

            // Create attendance record
            const attendance = new Attendance({
                student: student._id,
                group: groupId,
                doctor: req.user.id,
                lectureDate: new Date(),
                status: 'present',
                recordedBy: 'qr_scan',
                lectureDetails
            });

            await attendance.save();

            // Populate the attendance record for response
            const populatedAttendance = await Attendance.findById(attendance._id)
                .populate('student', 'name studentNumber')
                .populate('group', 'name code')
                .populate('doctor', 'name');

            res.status(201).json({
                success: true,
                message: 'Attendance recorded successfully',
                data: populatedAttendance
            });

        } catch (error) {
            console.error('QR scan error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing QR code scan'
            });
        }
    }

    // Manually record attendance
    static async recordAttendance(req, res) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { studentId, groupId, status, lectureDate, notes, lectureDetails = {} } = req.body;

            // Verify student exists and belongs to group
            const student = await Student.findById(studentId);
            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Student not found'
                });
            }

            if (student.group.toString() !== groupId) {
                return res.status(400).json({
                    success: false,
                    message: 'Student does not belong to this group'
                });
            }

            // Check if doctor is assigned to this group
            if (req.user.role === 'doctor') {
                const doctor = await Doctor.findById(req.user.id);
                if (!doctor.assignedGroups.includes(groupId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'You are not assigned to this group'
                    });
                }
            }

            // Check for existing attendance record
            const lectureDateTime = new Date(lectureDate);
            const startOfDay = new Date(lectureDateTime.getFullYear(), lectureDateTime.getMonth(), lectureDateTime.getDate());
            const endOfDay = new Date(lectureDateTime.getFullYear(), lectureDateTime.getMonth(), lectureDateTime.getDate(), 23, 59, 59);

            const existingAttendance = await Attendance.findOne({
                student: studentId,
                group: groupId,
                lectureDate: {
                    $gte: startOfDay,
                    $lte: endOfDay
                }
            });

            if (existingAttendance) {
                return res.status(409).json({
                    success: false,
                    message: 'Attendance already recorded for this student on this date'
                });
            }

            // Create attendance record
            const attendance = new Attendance({
                student: studentId,
                group: groupId,
                doctor: req.user.id,
                lectureDate: lectureDateTime,
                status,
                recordedBy: 'manual',
                notes,
                lectureDetails
            });

            await attendance.save();

            const populatedAttendance = await Attendance.findById(attendance._id)
                .populate('student', 'name studentNumber')
                .populate('group', 'name code')
                .populate('doctor', 'name');

            res.status(201).json({
                success: true,
                message: 'Attendance recorded successfully',
                data: populatedAttendance
            });

        } catch (error) {
            console.error('Record attendance error:', error);
            res.status(500).json({
                success: false,
                message: 'Error recording attendance'
            });
        }
    }

    // Get attendance records
    static async getAttendanceRecords(req, res) {
        try {
            const {
                page = 1,
                limit = 20,
                groupId,
                studentId,
                doctorId,
                startDate,
                endDate,
                status
            } = req.query;

            const query = {};

            if (groupId) query.group = groupId;
            if (studentId) query.student = studentId;
            if (doctorId) query.doctor = doctorId;
            if (status) query.status = status;

            if (startDate || endDate) {
                query.lectureDate = {};
                if (startDate) query.lectureDate.$gte = new Date(startDate);
                if (endDate) query.lectureDate.$lte = new Date(endDate);
            }

            // Apply access control based on user role
            if (req.user.role === 'doctor') {
                const doctor = await Doctor.findById(req.user.id);
                query.group = { $in: doctor.assignedGroups };
            } else if (req.user.role === 'student') {
                query.student = req.user.id;
            }

            const attendance = await Attendance.find(query)
                .populate('student', 'name studentNumber')
                .populate('group', 'name code')
                .populate('doctor', 'name profile.title')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ lectureDate: -1 });

            const total = await Attendance.countDocuments(query);

            res.json({
                success: true,
                data: attendance,
                pagination: {
                    page: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total
                }
            });

        } catch (error) {
            console.error('Get attendance records error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching attendance records'
            });
        }
    }

    // Update attendance record
    static async updateAttendance(req, res) {
        try {
            const { status, notes, lectureDetails } = req.body;
            const attendanceId = req.params.id;

            const attendance = await Attendance.findById(attendanceId);

            if (!attendance) {
                return res.status(404).json({
                    success: false,
                    message: 'Attendance record not found'
                });
            }

            // Check authorization
            if (req.user.role === 'doctor' && attendance.doctor.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Can only update your own attendance records'
                });
            }

            const updateData = {};
            if (status) updateData.status = status;
            if (notes !== undefined) updateData.notes = notes;
            if (lectureDetails) updateData.lectureDetails = { ...attendance.lectureDetails, ...lectureDetails };

            const updatedAttendance = await Attendance.findByIdAndUpdate(
                attendanceId,
                updateData,
                { new: true, runValidators: true }
            )
                .populate('student', 'name studentNumber')
                .populate('group', 'name code')
                .populate('doctor', 'name');

            res.json({
                success: true,
                message: 'Attendance updated successfully',
                data: updatedAttendance
            });

        } catch (error) {
            console.error('Update attendance error:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating attendance'
            });
        }
    }

    // Delete attendance record
    static async deleteAttendance(req, res) {
        try {
            const attendance = await Attendance.findById(req.params.id);

            if (!attendance) {
                return res.status(404).json({
                    success: false,
                    message: 'Attendance record not found'
                });
            }

            // Check authorization
            if (req.user.role === 'doctor' && attendance.doctor.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Can only delete your own attendance records'
                });
            }

            await Attendance.findByIdAndDelete(req.params.id);

            res.json({
                success: true,
                message: 'Attendance record deleted successfully'
            });

        } catch (error) {
            console.error('Delete attendance error:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting attendance record'
            });
        }
    }

    // Get attendance statistics
    static async getAttendanceStats(req, res) {
        try {
            const { groupId, studentId, startDate, endDate } = req.query;

            const matchQuery = {};
            if (groupId) matchQuery.group = mongoose.Types.ObjectId(groupId);
            if (studentId) matchQuery.student = mongoose.Types.ObjectId(studentId);
            if (startDate || endDate) {
                matchQuery.lectureDate = {};
                if (startDate) matchQuery.lectureDate.$gte = new Date(startDate);
                if (endDate) matchQuery.lectureDate.$lte = new Date(endDate);
            }

            // Apply access control
            if (req.user.role === 'doctor') {
                const doctor = await Doctor.findById(req.user.id);
                matchQuery.group = { $in: doctor.assignedGroups.map(id => mongoose.Types.ObjectId(id)) };
            } else if (req.user.role === 'student') {
                matchQuery.student = mongoose.Types.ObjectId(req.user.id);
            }

            const stats = await Attendance.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            const totalStats = await Attendance.aggregate([
                { $match: matchQuery },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        present: {
                            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                        },
                        absent: {
                            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
                        },
                        late: {
                            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
                        },
                        excused: {
                            $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] }
                        }
                    }
                }
            ]);

            const result = totalStats.length > 0 ? totalStats[0] : {
                total: 0, present: 0, absent: 0, late: 0, excused: 0
            };

            result.attendancePercentage = result.total > 0
                ? Math.round((result.present / result.total) * 100 * 100) / 100
                : 0;

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            console.error('Get attendance stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching attendance statistics'
            });
        }
    }

    // Bulk attendance record
    static async bulkRecordAttendance(req, res) {
        try {
            const { groupId, lectureDate, attendanceList, lectureDetails = {} } = req.body;

            if (!groupId || !attendanceList || !Array.isArray(attendanceList)) {
                return res.status(400).json({
                    success: false,
                    message: 'Group ID and attendance list are required'
                });
            }

            // Check if doctor is assigned to this group
            if (req.user.role === 'doctor') {
                const doctor = await Doctor.findById(req.user.id);
                if (!doctor.assignedGroups.includes(groupId)) {
                    return res.status(403).json({
                        success: false,
                        message: 'You are not assigned to this group'
                    });
                }
            }

            const results = [];
            const errors = [];

            for (const item of attendanceList) {
                try {
                    const { studentId, status, notes } = item;

                    // Check if attendance already exists
                    const lectureDateTime = new Date(lectureDate);
                    const startOfDay = new Date(lectureDateTime.getFullYear(), lectureDateTime.getMonth(), lectureDateTime.getDate());
                    const endOfDay = new Date(lectureDateTime.getFullYear(), lectureDateTime.getMonth(), lectureDateTime.getDate(), 23, 59, 59);

                    const existingAttendance = await Attendance.findOne({
                        student: studentId,
                        group: groupId,
                        lectureDate: {
                            $gte: startOfDay,
                            $lte: endOfDay
                        }
                    });

                    if (existingAttendance) {
                        errors.push({
                            studentId,
                            message: 'Attendance already recorded for this date'
                        });
                        continue;
                    }

                    const attendance = new Attendance({
                        student: studentId,
                        group: groupId,
                        doctor: req.user.id,
                        lectureDate: lectureDateTime,
                        status,
                        recordedBy: 'manual',
                        notes,
                        lectureDetails
                    });

                    await attendance.save();
                    results.push({
                        studentId,
                        attendanceId: attendance._id,
                        status: 'success'
                    });

                } catch (error) {
                    errors.push({
                        studentId: item.studentId,
                        message: error.message
                    });
                }
            }

            res.json({
                success: true,
                message: `Processed ${results.length} attendance records`,
                data: {
                    successful: results,
                    errors: errors
                }
            });

        } catch (error) {
            console.error('Bulk attendance error:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing bulk attendance'
            });
        }
    }
}

module.exports = AttendanceController;