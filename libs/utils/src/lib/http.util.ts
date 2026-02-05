import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';

export class HttpUtil {
  constructor(private readonly httpService: HttpService) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.httpService.axiosRef.get<T>(url, config);
    this.validateResponse(response, 'GET', url);
    return response.data;
  }

  async post<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.httpService.axiosRef.post<T>(url, data, config);
    this.validateResponse(response, 'POST', url);
    return response.data;
  }

  async put<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<T> {
    const response = await this.httpService.axiosRef.put<T>(url, data, config);
    this.validateResponse(response, 'PUT', url);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.httpService.axiosRef.delete<T>(url, config);
    this.validateResponse(response, 'DELETE', url);
    return response.data;
  }

  private validateResponse<T>(
    response: AxiosResponse<T>,
    method: string,
    url: string
  ): void {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `${method} request failed: ${url} - Status: ${response.status}`
      );
    }

    if (!response.data) {
      throw new Error(
        `${method} request returned empty data: ${url} - Status: ${response.status}`
      );
    }
  }
}
