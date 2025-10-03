const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
    },
    department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department',
        required: true,
    },
    year: {
        type: Number,
        required: true,
        min: 1,
        max: 6,
    },
    semester: {
        type: Number,
        required: true,
        min: 1,
        max: 2,
    },
    capacity: {
        type: Number,
        default: 30,
        min: 1,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for students
groupSchema.virtual('students', {
    ref: 'Student',
    localField: '_id',
    foreignField: 'group',
});

// Virtual for assigned doctors
groupSchema.virtual('assignedDoctors', {
    ref: 'Doctor',
    localField: '_id',
    foreignField: 'assignedGroups',
});

// Index for unique group per department and year
groupSchema.index({ name: 1, department: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Group', groupSchema);