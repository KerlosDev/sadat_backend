const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
    },
    lectureDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        required: true,
        enum: ['present', 'absent', 'late', 'excused'],
        default: 'present',
    },
    recordedAt: {
        type: Date,
        default: Date.now,
    },
    recordedBy: {
        type: String,
        enum: ['qr_scan', 'manual', 'admin'],
        default: 'qr_scan',
    },
    notes: {
        type: String,
        trim: true,
    },
    lectureDetails: {
        subject: String,
        lectureNumber: Number,
        duration: Number, // in minutes
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound index to prevent duplicate attendance records for same student on same lecture
attendanceSchema.index({
    student: 1,
    group: 1,
    lectureDate: 1
}, {
    unique: true,
    partialFilterExpression: { status: { $ne: 'absent' } }
});

// Index for efficient queries
attendanceSchema.index({ group: 1, lectureDate: -1 });
attendanceSchema.index({ student: 1, lectureDate: -1 });
attendanceSchema.index({ doctor: 1, lectureDate: -1 });

// Static method to get attendance statistics
attendanceSchema.statics.getAttendanceStats = async function (filters = {}) {
    const pipeline = [
        { $match: filters },
        {
            $group: {
                _id: {
                    student: '$student',
                    status: '$status'
                },
                count: { $sum: 1 }
            }
        },
        {
            $group: {
                _id: '$_id.student',
                total: { $sum: '$count' },
                present: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.status', 'present'] }, '$count', 0]
                    }
                },
                absent: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.status', 'absent'] }, '$count', 0]
                    }
                },
                late: {
                    $sum: {
                        $cond: [{ $eq: ['$_id.status', 'late'] }, '$count', 0]
                    }
                }
            }
        },
        {
            $addFields: {
                attendancePercentage: {
                    $multiply: [
                        { $divide: ['$present', '$total'] },
                        100
                    ]
                }
            }
        }
    ];

    return this.aggregate(pipeline);
};

module.exports = mongoose.model('Attendance', attendanceSchema);