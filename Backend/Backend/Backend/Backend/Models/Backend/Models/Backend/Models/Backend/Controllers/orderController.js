const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const Coupon = require('../models/Coupon');
const User = require('../models/User');

exports.createOrder = async (req, res) => {
  try {
    const { items, addressId, couponCode, paymentMethod } = req.body;
    const userId = req.user.id;

    // Validate items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    // Get user's address
    const user = await User.findById(userId);
    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(400).json({ message: 'Invalid address' });
    }

    // Calculate order with menu items
    let orderItems = [];
    let totalAmount = 0;

    for (const item of items) {
      const menuItem = await MenuItem.findById(item.menuItemId);
      
      if (!menuItem) {
        return res.status(404).json({ message: `Item ${item.menuItemId} not found` });
      }
      
      if (!menuItem.isAvailable) {
        return res.status(400).json({ message: `${menuItem.name} is out of stock` });
      }

      if (menuItem.stock < item.quantity) {
        return res.status(400).json({ message: `Insufficient stock for ${menuItem.name}` });
      }

      const itemTotal = menuItem.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        menuItem: menuItem._id,
        name: menuItem.name,
        quantity: item.quantity,
        price: menuItem.price
      });

      // Update stock and order count
      menuItem.stock -= item.quantity;
      menuItem.orderCount += item.quantity;
      await menuItem.save();
    }

    // Apply coupon if provided
    let discount = 0;
    let couponApplied = null;

    if (couponCode) {
      const coupon = await Coupon.findOne({ 
        code: couponCode.toUpperCase(),
        isActive: true,
        $or: [
          { expiryDate: { $gt: new Date() } },
          { expiryDate: null }
        ]
      });

      if (coupon) {
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
          return res.status(400).json({ message: 'Coupon usage limit reached' });
        }

        if (totalAmount >= coupon.minOrderAmount) {
          if (coupon.discountType === 'percentage') {
            discount = (totalAmount * coupon.discountValue) / 100;
            if (coupon.maxDiscount) {
              discount = Math.min(discount, coupon.maxDiscount);
            }
          } else {
            discount = Math.min(coupon.discountValue, totalAmount);
          }

          couponApplied = coupon._id;
          coupon.usedCount += 1;
          await coupon.save();
        }
      }
    }

    const finalAmount = totalAmount - discount;

    // Create order
    const order = new Order({
      user: userId,
      items: orderItems,
      deliveryAddress: address,
      totalAmount,
      discount,
      couponApplied,
      finalAmount,
      paymentMethod: paymentMethod || 'cod',
      estimatedDelivery: new Date(Date.now() + 45 * 60000) // 45 minutes
    });

    await order.save();

    // Add to user's order history
    user.orderHistory.push(order._id);
    await user.save();

    res.status(201).json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ user: userId })
      .sort({ orderDate: -1 })
      .populate('items.menuItem');

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Validate status transition
    const validTransitions = {
      'pending': ['accepted', 'rejected'],
      'accepted': ['preparing'],
      'preparing': ['out_for_delivery'],
      'out_for_delivery': ['delivered']
    };

    if (!validTransitions[order.status]?.includes(status)) {
      return res.status(400).json({ 
        message: `Cannot change status from ${order.status} to ${status}` 
      });
    }

    order.status = status;
    order.statusUpdates.push({ status });
    await order.save();

    // Emit socket event for real-time update
    const io = req.app.get('io');
    io.to(`order-${orderId}`).emit('order-status-update', {
      orderId,
      status,
      timestamp: new Date()
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reorder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const originalOrder = await Order.findById(orderId);

    if (!originalOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Create new order with same items
    const newOrder = new Order({
      user: req.user.id,
      items: originalOrder.items.map(item => ({
        menuItem: item.menuItem,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      deliveryAddress: originalOrder.deliveryAddress,
      totalAmount: originalOrder.totalAmount,
      discount: 0,
      finalAmount: originalOrder.totalAmount,
      paymentMethod: 'cod',
      estimatedDelivery: new Date(Date.now() + 45 * 60000)
    });

    await newOrder.save();

    // Update user's order history
    await User.findByIdAndUpdate(req.user.id, {
      $push: { orderHistory: newOrder._id }
    });

    // Update stock
    for (const item of originalOrder.items) {
      await MenuItem.findByIdAndUpdate(item.menuItem, {
        $inc: { stock: -item.quantity, orderCount: item.quantity }
      });
    }

    res.status(201).json(newOrder);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAdminOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ orderDate: -1 })
      .populate('user', 'name email phone')
      .populate('items.menuItem');

    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
