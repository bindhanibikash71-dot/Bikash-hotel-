const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    enum: ['veg', 'non-veg', 'drinks'],
    required: true
  },
  image: {
    type: String,
    default: 'default-food.jpg'
  },
  isSpecial: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  stock: {
    type: Number,
    default: 100
  },
  orderCount: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
