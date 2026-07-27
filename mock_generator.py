import json

def generate_mocks():
    # Mock Users with varying completeness
    mock_users = [
        {
            "id": "usr_active_123",
            "phone": "09123456789",
            "name": "Active Student",
            "email": "student@example.com",
            "locale": "fa",
            "timezone": "Asia/Tehran",
            "profileComplete": True,
            "status": "ACTIVE",
            "roles": ["STUDENT"],
            "permissions": []
        },
        {
            "id": "usr_incomplete_000",
            "phone": "09999999999",
            "name": "Newbie",
            "email": None,
            "locale": "en",
            "timezone": "UTC",
            "profileComplete": False,
            "status": "PENDING",
            "roles": ["STUDENT"],
            "permissions": []
        }
    ]

    # Mock Teachers
    mock_teachers = [
        {
            "id": "tch_111",
            "userId": "usr_tch_111",
            "nameFa": "استاد برتر",
            "nameEn": "Top Teacher",
            "slug": "top-teacher",
            "bio": "Expert in IELTS and TOEFL with 10 years of experience. Expect intense classes and lots of homework. " * 5,
            "status": "APPROVED",
            "price": 1000000,
            "trialPrice": 0,
            "rating": 4.9,
            "reviews": 150
        },
        {
            "id": "tch_222",
            "userId": "usr_tch_222",
            "nameFa": "استاد جدید",
            "nameEn": "New Teacher",
            "slug": "new-teacher",
            "bio": "",
            "status": "APPROVED",
            "price": 300000,
            "trialPrice": 300000,
            "rating": 0,
            "reviews": 0
        }
    ]

    # Mock Bookings matching BookingResponseDto exactly
    mock_bookings = [
        {
            "id": "bkg_conf_1",
            "startsAt": "2024-05-01T10:00:00.000Z",
            "endsAt": "2024-05-01T11:00:00.000Z",
            "status": "CONFIRMED",
            "type": "regular",
            "timezone": "Asia/Tehran",
            "teacher": {
                "id": "tch_111",
                "nameFa": "استاد برتر",
                "nameEn": "Top Teacher",
                "slug": "top-teacher"
            },
            "student": {
                "id": "usr_active_123",
                "name": "Active Student"
            },
            "link": "https://meet.jit.si/lingospeak-conf-1"
        },
        {
            "id": "bkg_pend_1",
            "startsAt": "2024-06-01T14:00:00.000Z",
            "endsAt": "2024-06-01T14:30:00.000Z",
            "status": "PENDING_PAYMENT",
            "type": "trial",
            "timezone": "UTC",
            "teacher": {
                "id": "tch_222",
                "nameFa": "استاد جدید",
                "nameEn": "New Teacher",
                "slug": "new-teacher"
            },
            "student": {
                "id": "usr_active_123",
                "name": "Active Student"
            },
            "link": None
        },
        {
            "id": "bkg_canc_1",
            "startsAt": "2023-01-01T10:00:00.000Z",
            "endsAt": "2023-01-01T11:00:00.000Z",
            "status": "CANCELLED",
            "type": "regular",
            "timezone": "Asia/Tehran",
            "teacher": {
                "id": "tch_111",
                "nameFa": "استاد برتر",
                "nameEn": "Top Teacher",
                "slug": "top-teacher"
            },
            "student": {
                "id": "usr_active_123",
                "name": "Active Student"
            },
            "link": None
        }
    ]

    mock_data = {
        "users": mock_users,
        "teachers": mock_teachers,
        "bookings": mock_bookings
    }

    with open('apps/web/mockData.json', 'w', encoding='utf-8') as f:
        json.dump(mock_data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    generate_mocks()
