"""Seeds a throwaway local PocketBase with a realistic demo client for help-guide screenshots."""
import base64, json, sys, urllib.request, datetime, random, string

PB = 'http://127.0.0.1:8095'
PHOTOS = sys.argv[1]  # marketing-site/public

def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(PB + path, data=data, method=method, headers={'Content-Type': 'application/json', **({'Authorization': token} if token else {})})
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read() or b'{}')
    except urllib.error.HTTPError as e:
        print('ERR', method, path, e.read()[:300]); raise

tok = req('POST', '/api/collections/_superusers/auth-with-password', {'identity': 'admin@local.test', 'password': 'LocalTest123!'})['token']
def make(coll, body): return req('POST', f'/api/collections/{coll}/records', body, tok)
for coll in ['screens', 'screen_groups', 'playlists', 'media_items', 'invoices', 'payments', 'licenses', 'organizations', 'users']:
    for r in req('GET', f'/api/collections/{coll}/records?perPage=200', None, tok).get('items', []):
        req('DELETE', f'/api/collections/{coll}/records/{r["id"]}', None, tok)
def pid(): return ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(15))

today = datetime.date.today()
iso = lambda d: d.isoformat()
now = datetime.datetime.utcnow()
EMAIL = 'priya@cafearoma.in'

org = make('organizations', {'id': pid(), 'name': 'Café Aroma', 'adminName': 'Priya Sharma', 'email': EMAIL, 'planType': 'Business',
                             'screensAllowed': 5, 'storageLimit': 10, 'subscriptionStatus': 'active', 'renewalDate': iso(today + datetime.timedelta(days=18))})
make('users', {'email': EMAIL, 'password': 'ClientPass123', 'passwordConfirm': 'ClientPass123', 'name': 'Priya Sharma', 'role': 'org_admin',
               'status': 'active', 'firstTimeLogin': False, 'company': 'Café Aroma', 'mobile': '+91 98765 43210', 'emailVisibility': True})
make('users', {'email': 'owner@local.test', 'password': 'OwnerPass123', 'passwordConfirm': 'OwnerPass123', 'name': 'Owner Test',
               'role': 'super_admin', 'status': 'active', 'firstTimeLogin': False})
lic = make('licenses', {'id': pid(), 'name': 'Café Aroma — Business', 'assignedOrgId': org['id'], 'assignedOrgName': 'Café Aroma', 'assignedUserEmail': EMAIL,
                        'price': 1499, 'tenure': 'monthly', 'status': 'active', 'expiryDate': iso(today + datetime.timedelta(days=18)),
                        'storageLimit': 10, 'deviceLimit': 5, 'whiteLabel': False, 'enableVideoConferencing': False})

def photo(rel):
    # Served by the dashboard's dev server from public/help-seed (removed after capture).
    raw = open(f'{PHOTOS}/{rel}', 'rb').read()
    return '/help-seed/' + rel.split('/')[-1], len(raw)

media = []
for title, rel in [('Morning menu', 'installations/04-cafe-standee.webp'), ('Weekend offer', 'installations/07-lobby-standee.webp'),
                   ('Store front', 'installations/08-showroom.webp'), ('New arrivals', 'products/standee.webp'),
                   ('Loyalty card', 'installations/05-qsr-kiosks.webp'), ('Opening hours', 'products/info-kiosk.webp')]:
    url, size = photo(rel)
    media.append(make('media_items', {'id': pid(), 'title': title, 'type': 'image', 'duration': 10, 'resolution': '1080x1920', 'fileSize': f'{size // 1024} KB',
                                      'fileSizeBytes': size * 40, 'uploadedBy': EMAIL, 'expiryDate': iso(today + datetime.timedelta(days=365)), 'tags': ['uploaded', 'image'],
                                      'status': 'active', 'thumbnail': url, 'fileUrl': url, 'width': 1080, 'height': 1920, 'mimeType': 'image/webp'}))

def slides(items, secs):
    return [{'id': f'slide_{pid()}', 'mediaId': m['id'], 'duration': s, 'layoutType': 'single'} for m, s in zip(items, secs)]
pl_morning = make('playlists', {'id': pid(), 'name': 'Morning menu', 'createdBy': EMAIL, 'active': True, 'scheduleStatus': 'Running', 'orientation': 'vertical',
                                'transition': 'fade', 'loop': True, 'shuffle': False, 'volume': 60, 'slides': slides(media[:4], [10, 8, 12, 10]),
                                'mediaIds': [m['id'] for m in media[:4]], 'mediaCount': 4, 'assignedScreenIds': [], 'assignedScreens': 0})
pl_evening = make('playlists', {'id': pid(), 'name': 'Evening offers', 'createdBy': EMAIL, 'active': True, 'scheduleStatus': 'Running', 'orientation': 'vertical',
                                'transition': 'slide', 'loop': True, 'shuffle': False, 'volume': 60, 'slides': slides(media[3:6], [15, 10, 10]),
                                'mediaIds': [m['id'] for m in media[3:6]], 'mediaCount': 3, 'assignedScreenIds': [], 'assignedScreens': 0})

grp = make('screen_groups', {'id': pid(), 'name': 'Bandra outlet', 'desc': 'Screens at the Bandra café', 'color': 'blue', 'playlist': 'Morning menu',
                             'orgId': org['id'], 'createdBy': EMAIL})

def screen(name, status, location, playlist, group='', heartbeat_mins=0):
    hb = (now - datetime.timedelta(minutes=heartbeat_mins)).isoformat() + 'Z'
    return make('screens', {'id': pid(), 'name': name, 'status': status, 'location': location, 'playlist': playlist['name'] if playlist else '',
                            'playlistId': playlist['id'] if playlist else '', 'licenseType': 'Pro', 'lastHeartbeat': hb if status != 'unlinked' else '',
                            'playerVersion': '1.1' if status != 'unlinked' else '', 'storageUsed': 12, 'groupId': group, 'assignedToUserEmail': EMAIL,
                            'license_id': lic['id'], 'orientation': 'portrait', 'screenSize': '55"', 'volume': 60, 'hardware_uuid': pid() if status != 'unlinked' else '',
                            'onlineSince': hb if status == 'online' else '', 'cumulativeUptime': 86400 * 6, 'cumulativeLoops': 840})
screen('Counter display', 'online', 'Maharashtra · Bandra West', pl_morning, grp['id'])
screen('Entrance standee', 'online', 'Maharashtra · Bandra West', pl_morning, grp['id'])
screen('Window display', 'offline', 'Karnataka · Indiranagar', pl_evening, '', 140)
screen('Kitchen screen', 'unlinked', 'Karnataka · Indiranagar', None)

paid_on = today - datetime.timedelta(days=12)
make('invoices', {'id': pid(), 'licenseId': lic['id'], 'licenseName': lic['name'], 'clientName': 'Café Aroma', 'clientEmail': EMAIL, 'amount': 1499,
                  'dueDate': iso(paid_on), 'status': 'paid', 'issuedDate': iso(paid_on), 'number': 'INV-2026-0042', 'paidDate': iso(paid_on), 'paymentRef': 'pay_Demo42Xq'})
make('payments', {'id': pid(), 'licenseId': lic['id'], 'licenseName': lic['name'], 'clientName': 'Café Aroma', 'clientEmail': EMAIL, 'amount': 1499,
                  'paymentDate': f'{iso(paid_on)} 11:24', 'status': 'success', 'razorpayPaymentId': 'pay_Demo42Xq', 'razorpayOrderId': 'order_Demo42'})
print('seeded', len(media), 'media')
