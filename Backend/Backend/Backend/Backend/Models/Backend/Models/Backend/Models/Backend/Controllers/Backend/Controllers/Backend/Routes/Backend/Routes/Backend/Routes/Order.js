const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

router.post('/', auth, orderController.createOrder);
router.get('/', auth, orderController.getOrders);
router.patch('/:id/status', auth, adminAuth, orderController.updateOrderStatus);
router.post('/:orderId/reorder', auth, orderController.reorder);
router.get('/admin/all', auth, adminAuth, orderController.getAdminOrders);

module.exports = router;
