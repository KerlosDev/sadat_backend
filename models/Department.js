const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        maxlength: 10,
    },
    description: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for groups
departmentSchema.virtual('groups', {
    ref: 'Group',
    localField: '_id',
    foreignField: 'department',
});

// Virtual for doctors
departmentSchema.virtual('doctors', {
    ref: 'Doctor',
    localField: '_id',
    foreignField: 'department',
});

module.exports = mongoose.model('Department', departmentSchema);