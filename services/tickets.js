const TicketModel = require('../models/ticket')
const sendEmail = require('../libs/email')
const randomString = require('randomstring')
const jwt = require('jsonwebtoken')
const { jwtSecret } = require('../config')

class Tickets {
  validate (error) {
    // console.log(error)
    const errorMessages = Object.keys(error.errors).map(e => {
      const err = error.errors[e]
      return err.properties.message
    })
    return { fail: true, message: errorMessages }
  }

  async getAll (limit, page) {
    limit || (limit = 20)
    page || (page = 1)
    const tickets = await TicketModel.paginate({}, { limit, page, sort: { createdAt: -1 }, populate: { path: 'viewed.by closed.by', select: 'username' } })
    tickets.filter = 'none'
    return tickets
  }

  async getById (id) {
    if (!id) return { fail: true, message: 'Introduce el id del ticket.' }

    const ticket = await TicketModel.findById(id).populate('viewed.by closed.by', 'username')
    if (!ticket) return { fail: true, message: 'No existe un ticket con ese id.' }

    return ticket
  }

  async getByNumber (ticketNumber, secretKey) {
    if (!ticketNumber) return { fail: true, message: 'Introduce el número del ticket.' }
    else if (!secretKey) return { fail: true, message: 'Introduce el código secreto.' }

    const ticket = await TicketModel.findOne({ ticketNumber }).populate('viewed.by closed.by', 'username')
    if (!ticket) return { fail: true, message: 'No existe un ticket con ese número.' }

    if (ticket.secretKey === secretKey) return ticket
    return { fail: true, message: 'El código secreto no es válido.' }
  }

  async getByFilter (filter, param, limit, page) {
    if (!filter || !param || filter === undefined || param === undefined) return { fail: true, message: 'Introduce el filtro y el parámetro. ' }

    limit || (limit = 20)
    page || (page = 1)
    const tickets = await TicketModel.paginate({ [filter]: param }, { limit, page, sort: { createdAt: -1 }, populate: { path: 'viewed.by closed.by', select: 'username' } })
    tickets.filter = filter
    tickets.param = param
    return tickets
  }

  async create (data) {
    if (!data) return { fail: true, message: 'Ingresa la información.' } // Data = { username, email, text }
    data.secretKey = randomString.generate({
      length: 16,
      readable: true,
      charset: 'alphanumeric',
      capitalization: 'lowercase'
    })

    const newTicket = new TicketModel(data)
    const validation = newTicket.validateSync()
    if (validation) return this.validate(validation)

    await newTicket.save()

    await sendEmail(
      data.email,
      'Ticket creado con éxito',
      'Tu problema será resuelto a la brevedad.',
      `<h1>${data.username}, tu problema será resuelto a la brevedad.</h1>
      <br>
      <h2>Una copia de tu ticket:</h2>
      </br>
      <h3>${data.title}</h3>
      <p>${data.text}</p>
      <p>Número de ticket: ${newTicket.ticketNumber}</p>
      <p>Código secreto (no compartir): ${newTicket.secretKey}</p>`
    )

    return { success: true, message: 'Ticket creado con éxito, un email ha sido enviado a su correo.', newTicket }
  }

  async markViewed (id, cookie) {
    if (!id) return { fail: true, message: 'Introduce el id del ticket.' }

    let ticket = await TicketModel.findById(id)
    if (!ticket) return { fail: true, message: 'No existe un ticket con ese id.' }
    else if (ticket.viewed.status) return { fail: true, message: 'Ese ticket ya fue marcado como visto.' }

    const { id: userId } = jwt.verify(cookie, jwtSecret)

    ticket.viewed = {
      status: true,
      by: userId,
      on: Date.now()
    }
    await ticket.save()
    ticket = await TicketModel.findById(id).populate('viewed.by', 'username')

    await sendEmail(
      ticket.email,
      'Ticket visto',
      'Tu problema ya está siendo estudiado.',
      `<h1>${ticket.username}, tu ticket está siendo revisado por un técnico.</h1>
      <br>
      <h2>Una copia de tu ticket:</h2>
      </br>
      <h3>${ticket.title}</h3>
      <p>${ticket.text}</p>
      <p>Número de ticket: ${ticket.ticketNumber}
      <p>Código secreto (no compartir): ${ticket.secretKey}</p>`
    )

    return { success: true, message: 'Ticket visto con éxito.', ticket }
  }

  async markClosed (id, summary, cookie) {
    if (!id) return { fail: true, message: 'Introduce el id del ticket.' }
    else if (!summary) return { fail: true, message: 'Introduce el resumen del problema.' }

    let ticket = await TicketModel.findById(id)
    if (!ticket) return { fail: true, message: 'No existe un ticket con ese id.' }
    else if (!ticket.viewed.status) return { fail: true, message: 'El ticket debe ser marcado primero como visto.' }
    else if (ticket.closed.status) return { fail: true, message: 'Ese ticket ya fue marcado como cerrado.' }

    const { id: userId } = jwt.verify(cookie, jwtSecret)
    console.log(userId)
    ticket.closed = {
      status: true,
      by: userId,
      on: Date.now(),
      summary
    }
    await ticket.save()
    ticket = await TicketModel.findById(id).populate('viewed.by closed.by', 'username')

    await sendEmail(
      ticket.email,
      'Ticket cerrado',
      'Tu problema ya fue solucionado.',
        `<h1>${ticket.username}, tu ticket ya está cerrado y te enviamos la respuesta del técnico.</h1>
        <br>
        <h2>Una copia de tu ticket:</h2>
        </br>
        <h3>${ticket.title}</h3>
        <p>${ticket.text}</p>
        <p>Número de ticket: ${ticket.ticketNumber}</p>
        <p>Código secreto (no compartir): ${ticket.secretKey}</p>
        <br>
        <h2>Respuesta a tu problema:</h2>
        </br>
        <h3>Cerrado por: ${ticket.closed.by.username}</h3>
        <p>Resumen de tu problema: ${ticket.closed.summary}</p>`
    )

    return { success: true, message: 'Ticket cerrado con éxito.', ticket }
  }
}

module.exports = Tickets
