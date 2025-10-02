import { HttpService } from '@nestjs/axios';
import { HttpStatus } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';

export class HttpUtil {
  constructor(private readonly httpService: HttpService) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.httpService.axiosRef.get<T>(url, config);

    if (response.status !== HttpStatus.OK || !response.data) {
      throw new Error(
        `GET request failed: ${url} - ${JSON.stringify(response.data)}`
      );
    }

    return response.data;
  }

  async post<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.httpService.axiosRef.post<T>(url, data, config);

    if (response.status !== HttpStatus.OK || !response.data) {
      throw new Error(
        `POST request failed: ${url} - ${JSON.stringify(response.data)}`
      );
    }

    return response.data;
  }

  async put<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.httpService.axiosRef.put<T>(url, data, config);

    if (response.status !== HttpStatus.OK || !response.data) {
      throw new Error(
        `PUT request failed: ${url} - ${JSON.stringify(response.data)}`
      );
    }

    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.httpService.axiosRef.delete<T>(url, config);

    if (response.status !== HttpStatus.OK || !response.data) {
      throw new Error(
        `DELETE request failed: ${url} - ${JSON.stringify(response.data)}`
      );
    }

    return response.data;
  }
}
