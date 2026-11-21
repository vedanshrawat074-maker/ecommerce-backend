/**
 * Application event bus (Node.js EventEmitter).
 * Controllers EMIT domain events; listeners (src/listeners) react to them.
 * This decouples business logic (placing an order) from side-effects (notifications).
 */
const EventEmitter = require('events');

const EVENTS = {
  ORDER_PLACED: 'order.placed',
  ORDER_STATUS_CHANGED: 'order.statusChanged',
  STOCK_LOW: 'stock.low',
};

class AppEvents extends EventEmitter {}
const bus = new AppEvents();

module.exports = { bus, EVENTS };
