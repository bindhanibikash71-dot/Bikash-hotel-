const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');

router.get('/', menuController.getMenu);
router.get('/:id', menuController.getItemById);

// Admin routes
router.post('/', auth, adminAuth, upload.single('image'), menuController.createItem);
router.put('/:id', auth, adminAuth, upload.single('image'), menuController.updateItem);
router.delete('/:id', auth, adminAuth, menuController.deleteItem);
router.patch('/:id/stock', auth, adminAuth, menuController.toggleStock);

module.exports = router;
