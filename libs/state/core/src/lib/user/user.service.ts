import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { UserProfile } from './user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://dummyjson.com/users';

  getProfile(userId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/${userId}`).pipe(
      map(({ id, username, email, firstName, lastName, phone, image }) => ({
        id,
        username,
        email,
        firstName,
        lastName,
        phone,
        image,
      }))
    );
  }
}
