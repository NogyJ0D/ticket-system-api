const express = require('express')
const { isHelper } = require('../middlewares/auth')
const Ticket = require('../services/tickets')

const tickets = app => {
  const router = express.Router()
  const ticketService = new Ticket()
  app.use('/tickets', router)

  router.get('/', isHelper, async (req, res) => {
    const { filter, param, limit, page } = req.query
    let tickets

    if (filter === 'none' && param === 'none') tickets = await ticketService.getAll(limit, page)
    else tickets = await ticketService.getByFilter(filter, param, limit, page)

    return res.status(200).json(tickets)
  })

  router.get('/id/:id', isHelper, async (req, res) => {
    const { id } = req.params
    const ticket = await ticketService.getById(id)

    ticket.fail
      ? res.status(400).json(ticket)
      : res.status(200).json(ticket)
  })

  router.get('/number/:ticketNumber/secret-key/:secretKey', async (req, res) => {
    const { ticketNumber, secretKey } = req.params
    const ticket = await ticketService.getByNumber(ticketNumber, secretKey)

    ticket.fail
      ? res.status(400).json(ticket)
      : res.status(200).json(ticket)
  })

  router.post('/', async (req, res) => {
    console.log(req.body)
    const ticket = await ticketService.create(req.body)

    ticket.fail
      ? res.status(400).json(ticket)
      : res.status(201).json(ticket)
  })

  router.put('/view/:id', isHelper, async (req, res) => {
    const { id } = req.params
    const ticket = await ticketService.markViewed(id, req.cookies.token)

    ticket.fail
      ? res.status(400).json(ticket)
      : res.status(200).json(ticket)
  })

  router.put('/close/:id', isHelper, async (req, res) => {
    const { id } = req.params
    const { summary } = req.body
    const ticket = await ticketService.markClosed(id, summary, req.cookies.token)

    ticket.fail
      ? res.status(400).json(ticket)
      : res.status(200).json(ticket)
  })
}

module.exports = tickets
