import Order from '../models/Order';
import File from '../models/File';
import Recipient from '../models/Recipient';
import Deliveryman from '../models/Deliveryman';

import OrderDetailsMail from '../jobs/OrderResponseEmail';
import Queue from '../../lib/Queue';

class OrderController {
  scheduleReleased() {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 8 && currentHour <= 18;
  }

  async index(req, res) {
    const { page = 1, per_page = 20 } = req.query;

    const orders = await Order.findAll({
      where: {
        canceled_at: null,
        end_date: null,
      },
      order: ['product'],
      attributes: ['id', 'product', 'canceled_at', 'start_date', 'end_date'],
      limit: per_page,
      offset: (page - 1) * per_page,
      include: [
        {
          model: Recipient,
          as: 'recipient',
          attributes: [
            'id',
            'name',
            'street',
            'street_number',
            'complement',
            'neighborhood',
            'state',
            'city',
            'zip_code',
          ],
        },
        {
          model: Deliveryman,
          as: 'deliveryman',
          attributes: ['id', 'name', 'email', 'canceled_at'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
        {
          model: File,
          as: 'signature',
          attributes: ['id', 'path', 'url'],
        },
      ],
    });
    return res.json(orders);
  }

  async store(req, res) {
    if (!this.scheduleReleased()) {
      return res.status(400).json({
        error: 'You can only pick up a product from 8:00 am to 18:00 pm.',
      });
    }

    const { recipient_id, deliveryman_id, signature_id, product } = req.body;

    const { id: orderId } = await Order.create({
      recipient_id,
      deliveryman_id,
      signature_id,
      product,
    });

    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Recipient,
          as: 'recipient',
          attributes: [
            'id',
            'name',
            'street',
            'street_number',
            'complement',
            'neighborhood',
            'state',
            'city',
            'zip_code',
          ],
        },
        {
          model: Deliveryman,
          as: 'deliveryman',
          attributes: ['id', 'name', 'email', 'canceled_at'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    await Queue.add(OrderResponseEmail.key, {
      order,
    });

    return res.json(order);
  }

  async update(req, res) {
    if (!this.scheduleReleased()) {
      return res.status(400).json({
        error: 'You can only pick up a product from 8:00 am to 18:00 pm.',
      });
    }

    const order = await Order.findByPk(req.params.id);

    await order.update(req.body);

    return res.json(order);
  }

  async delete(req, res) {
    if (!this.scheduleReleased()) {
      return res.status(400).json({
        error: 'You can only pick up a product from 8:00 am to 18:00 pm.',
      });
    }

    const order = await Order.findByPk(req.params.id);

    order.canceled_at = new Date();

    await order.save();

    return res.json(order);
  }
}

export default new OrderController();
