/**
 * Bangladesh Administrative Location Database
 * --------------------------------------------
 * Divisions, Districts, Upazilas/Thanas, and Unions/Areas for cascading location selectors.
 */

export const BD_DIVISIONS: string[] = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
]

export const BD_DISTRICTS_BY_DIVISION: Record<string, string[]> = {
  Dhaka: [
    'Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur',
    'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'
  ],
  Chattogram: [
    'Chattogram', 'Comilla', "Cox's Bazar", 'Feni', 'Khagrachhari', 'Lakshmipur',
    'Noakhali', 'Rangamati', 'Brahmanbaria', 'Chandpur'
  ],
  Rajshahi: [
    'Rajshahi', 'Bogra', 'Joypurhat', 'Naogaon', 'Natore', 'Nawabganj', 'Pabna', 'Sirajganj'
  ],
  Khulna: [
    'Khulna', 'Bagerhat', 'Chuadanga', 'Jessore', 'Jhenaidah', 'Kushtia',
    'Magura', 'Meherpur', 'Narail', 'Satkhira'
  ],
  Barishal: [
    'Barishal', 'Barguna', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'
  ],
  Sylhet: [
    'Sylhet', 'Habiganj', 'Moulvibazar', 'Sunamganj'
  ],
  Rangpur: [
    'Rangpur', 'Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Thakurgaon'
  ],
  Mymensingh: [
    'Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'
  ],
  // Fallbacks with ' Division' suffix for legacy compatibility
  'Dhaka Division': [
    'Dhaka', 'Faridpur', 'Gazipur', 'Gopalganj', 'Kishoreganj', 'Madaripur',
    'Manikganj', 'Munshiganj', 'Narayanganj', 'Narsingdi', 'Rajbari', 'Shariatpur', 'Tangail'
  ],
  'Chattogram Division': [
    'Chattogram', 'Comilla', "Cox's Bazar", 'Feni', 'Khagrachhari', 'Lakshmipur',
    'Noakhali', 'Rangamati', 'Brahmanbaria', 'Chandpur'
  ],
  'Rajshahi Division': [
    'Rajshahi', 'Bogra', 'Joypurhat', 'Naogaon', 'Natore', 'Nawabganj', 'Pabna', 'Sirajganj'
  ],
  'Khulna Division': [
    'Khulna', 'Bagerhat', 'Chuadanga', 'Jessore', 'Jhenaidah', 'Kushtia',
    'Magura', 'Meherpur', 'Narail', 'Satkhira'
  ],
  'Barishal Division': [
    'Barishal', 'Barguna', 'Bhola', 'Jhalokati', 'Patuakhali', 'Pirojpur'
  ],
  'Sylhet Division': [
    'Sylhet', 'Habiganj', 'Moulvibazar', 'Sunamganj'
  ],
  'Rangpur Division': [
    'Rangpur', 'Dinajpur', 'Gaibandha', 'Kurigram', 'Lalmonirhat', 'Nilphamari', 'Panchagarh', 'Thakurgaon'
  ],
  'Mymensingh Division': [
    'Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'
  ],
}

export const BD_UPAZILAS_BY_DISTRICT: Record<string, string[]> = {
  Dhaka: ['Mirpur', 'Dhanmondi', 'Gulshan', 'Uttara', 'Banani', 'Mohammadpur', 'Badda', 'Jatrabari', 'Savar', 'Gazipur Sadar', 'Keraniganj', 'Dhamrai', 'Dohar', 'Nawabganj'],
  Gazipur: ['Gazipur Sadar', 'Kaliakair', 'Kaliganj', 'Kapasia', 'Sreepur'],
  Narayanganj: ['Narayanganj Sadar', 'Araihazar', 'Bandar', 'Rupganj', 'Sonargaon'],
  Narsingdi: ['Narsingdi Sadar', 'Belabo', 'Monohardi', 'Palash', 'Raipura', 'Shibpur'],
  Tangail: ['Tangail Sadar', 'Basail', 'Bhuapur', 'Delduar', 'Ghatail', 'Gopalpur', 'Kalihati', 'Madhupur', 'Mirzapur', 'Nagarpur', 'Sakhipur'],
  Chattogram: ['Kotwali', 'Panchlaish', 'Agrabad', 'Halishahar', 'Double Mooring', 'Hathazari', 'Patiya', 'Sitakunda', 'Raozan', 'Fatikchhari', 'Chandanaish', 'Anwara'],
  Comilla: ['Comilla Sadar', 'Barura', 'Brahmanpara', 'Burichang', 'Chandina', 'Chauddagram', 'Daudkandi', 'Debidwar', 'Homna', 'Laksam', 'Monohargonj', 'Muradnagar'],
  "Cox's Bazar": ["Cox's Bazar Sadar", 'Chakaria', 'Kutubdia', 'Maheshkhali', 'Ramu', 'Teknaf', 'Ukhia'],
  Rajshahi: ['Boalia', 'Rajpara', 'Motihar', 'Shah Makhdum', 'Godagari', 'Tanore', 'Mohanpur', 'Bagmara', 'Durgapur', 'Puthia', 'Charghat', 'Bagha'],
  Bogra: ['Bogra Sadar', 'Adamdighi', 'Shajahanpur', 'Dhunat', 'Dhupchanchia', 'Gabtali', 'Kahaloo', 'Nandigram', 'Sariakakhi', 'Sherpur', 'Shibganj'],
  Khulna: ['Khulna Sadar', 'Sonadanga', 'Khalishpur', 'Daulatpur', 'Batiaghata', 'Dacope', 'Dumuria', 'Koyra', 'Paikgachha', 'Phultala', 'Rupsha', 'Terokhada'],
  Jessore: ['Jessore Sadar', 'Abhaynagar', 'Bagherpara', 'Chaugachha', 'Jhikargachha', 'Keshabpur', 'Manirampur', 'Sharsha'],
  Satkhira: ['Satkhira Sadar', 'Assasuni', 'Debhata', 'Kalaroa', 'Kaliganj', 'Shyamnagar', 'Tala'],
  Barishal: ['Barishal Sadar', 'Agailjhara', 'Babuganj', 'Bakerganj', 'Banaripara', 'Gaurnadi', 'Hizla', 'Mehendiganj', 'Muladi', 'Wazirpur'],
  Sylhet: ['Sylhet Sadar', 'Balaganj', 'Beanibazar', 'Bishwanath', 'Companiganj', 'Fenchuganj', 'Golapganj', 'Gowainghat', 'Jaintiapur', 'Kanaighat', 'Zakiganj'],
  Rangpur: ['Rangpur Sadar', 'Badarganj', 'Gangachara', 'Kaunia', 'Mithapukur', 'Pirgachha', 'Pirganj', 'Taraganj'],
  Mymensingh: ['Mymensingh Sadar', 'Bhaluka', 'Dhobaura', 'Fulbaria', 'Gafargaon', 'Gauripur', 'Haluaghat', 'Ishwarganj', 'Muktagachha', 'Nandail', 'Phulpur', 'Trishal'],
}

export const BD_AREAS_BY_UPAZILA: Record<string, string[]> = {
  Mirpur: ['Mirpur DOHS', 'Section 1', 'Section 2', 'Section 6', 'Section 10', 'Section 11', 'Section 12', 'Pallabi', 'Rupnagar', 'Kazipara', 'Shewrapara'],
  Uttara: ['Sector 1', 'Sector 3', 'Sector 4', 'Sector 5', 'Sector 7', 'Sector 9', 'Sector 10', 'Sector 11', 'Sector 12', 'Sector 13', 'Sector 14', 'Uttarkhan', 'Dakshinkhan'],
  Dhanmondi: ['Road 1 to 10', 'Road 11 to 20', 'Road 27', 'Sobhanbag', 'Rayer Bazar', 'Jigatola', 'Kalabagan'],
  Gulshan: ['Gulshan 1', 'Gulshan 2', 'Niketan', 'Baridhara', 'Baniani'],
  Banani: ['Banani DOHS', 'Chairman Bari', 'Block A', 'Block B', 'Block C'],
  Mohammadpur: ['Town Hall', 'Japan Garden City', 'Kaderabad Housing', 'Tajmahal Road', 'Babar Road', 'Ring Road'],
  Badda: ['Middle Badda', 'North Badda', 'South Badda', 'Merul Badda', 'Aftabnagar'],
  Jatrabari: ['Dhalpur', 'Sayedabad', 'Kutubkhali', 'Kajla', 'Donia'],
  Savar: ['Savar Bazar', 'EPZ Area', 'Dhamrai', 'Hemayetpur', 'Ashulia'],
}

/**
 * Returns available districts for a given division
 */
export function getDistrictsForDivision(divisionName: string): string[] {
  return BD_DISTRICTS_BY_DIVISION[divisionName] || []
}

/**
 * Returns available upazilas for a given district
 */
export function getUpazilasForDistrict(districtName: string): string[] {
  return BD_UPAZILAS_BY_DISTRICT[districtName] || [`${districtName} Sadar`, 'Center Area', 'Outer Area']
}

/**
 * Returns common areas/unions for a given upazila
 */
export function getAreasForUpazila(upazilaName: string): string[] {
  return BD_AREAS_BY_UPAZILA[upazilaName] || ['Main Area', 'Ward 1', 'Ward 2', 'Central Union', 'North Union', 'South Union']
}
