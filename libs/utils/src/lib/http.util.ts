import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig } from 'axios';

export class HttpUtil {
  constructor(private readonly httpService: HttpService) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.httpService.axiosRef.get<T>(url, {
      ...config,
      validateStatus: (status) => status < 600, // Accept all responses < 600
    });

    if (!response.data) {
      throw new Error(
        `GET request failed: ${url} - Status: ${response.status}`
      );
    }

    return response.data;
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.httpService.axiosRef.post<T>(url, data, {
      ...config,
      validateStatus: (status) => status < 600, // Accept all responses < 600
    });

    if (!response.data) {
      throw new Error(
        `POST request failed: ${url} - Status: ${response.status}`
      );
    }

    return response.data;
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.httpService.axiosRef.put<T>(url, data, {
      ...config,
      validateStatus: (status) => status < 600, // Accept all responses < 600
    });

    if (!response.data) {
      throw new Error(
        `PUT request failed: ${url} - Status: ${response.status}`
      );
    }

    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.httpService.axiosRef.delete<T>(url, {
      ...config,
      validateStatus: (status) => status < 600, // Accept all responses < 600
    });

    if (!response.data) {
      throw new Error(
        `DELETE request failed: ${url} - Status: ${response.status}`
      );
    }

    return response.data;
  }
}
