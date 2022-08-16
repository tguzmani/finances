import axios from 'axios'

export const config = { headers: { 'Content-Type': 'application/json' } }

export default class AxiosRepository {
  constructor(resource) {
    this.resource = resource
    this.instance = axios.create({
      baseURL: 'http://localhost:5000/api',
      withCredentials: true,
    })
  }

  endPoint(URL) {
    return `/${this.resource}${URL}`
  }

  async get(URL) {
    const response = await this.instance.get(this.endPoint(URL))
    return response.data
  }

  async post(URL, data) {
    const response = await this.instance.post(this.endPoint(URL), data, config)
    return response.data
  }

  async put(URL, data, config) {
    await this.instance.put(this.endPoint(URL), data, config)
  }

  async delete(URL) {
    await this.instance.delete(this.endPoint(URL))
  }
}
