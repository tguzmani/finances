import axios from 'axios'

export const config = { headers: { 'Content-Type': 'application/json' } }

export default class AxiosRepository {
  constructor(resource) {
    this.resource = resource
  }

  endPoint(URL) {
    return `/${this.resource}${URL}`
  }

  async get(URL) {
    const response = await axios.get(this.endPoint(URL))
    return response.data
  }

  async post(URL, data) {
    const response = await axios.post(this.endPoint(URL), data, config)
    return response.data
  }

  async put(URL, data, config) {
    await axios.put(this.endPoint(URL), data, config)
  }

  async delete(URL) {
    await axios.delete(this.endPoint(URL))
  }
}
