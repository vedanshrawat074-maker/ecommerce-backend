/**
 * EventEmitter listeners. Controllers emit domain events on the bus; these handlers
 * translate them into Socket.IO notifications (and could also send e-mail, write audit logs, ...).
 */
const { bus, EVENTS } = require('../utils/events');

module.exports = (io) => {
  // New order -> notify the seller
  bus.on(EVENTS.ORDER_PLACED, ({ order }) => {
    io.to(`user:${order.seller}`).emit('order:placed', {
      orderId: order._id, orderNumber: order.orderNumber, total: order.total,
      items: order.items.length, message: `New order ${order.orderNumber} received`,
    });
    console.log(`[event] ${EVENTS.ORDER_PLACED} ${order.orderNumber}`);
  });

  // Status change -> notify the customer (and the seller if an admin/customer made the change)
  bus.on(EVENTS.ORDER_STATUS_CHANGED, ({ order, previousStatus, actor }) => {
    const payload = {
      orderId: order._id, orderNumber: order.orderNumber, previousStatus, status: order.status,
      message: `Order ${order.orderNumber} is now ${order.status}`,
    };
    io.to(`user:${order.customer}`).emit('order:statusChanged', payload);
    if (String(actor._id) !== String(order.seller)) io.to(`user:${order.seller}`).emit('order:statusChanged', payload);
    console.log(`[event] ${EVENTS.ORDER_STATUS_CHANGED} ${order.orderNumber}: ${previousStatus} -> ${order.status}`);
  });

  // Low stock -> notify the seller and all admins
  bus.on(EVENTS.STOCK_LOW, ({ product }) => {
    const payload = {
      productId: product._id, name: product.name, stock: product.stock, threshold: product.lowStockThreshold,
      message: `Low stock: "${product.name}" has only ${product.stock} unit(s) left`,
    };
    io.to(`user:${product.seller}`).to('role:admin').emit('stock:low', payload);
    console.log(`[event] ${EVENTS.STOCK_LOW} ${product.name} (${product.stock})`);
  });
};
