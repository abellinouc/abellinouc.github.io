class Telescope {
    constructor( name, type, aperture, focalLength ) {
        this.name = name;
        this.type = type;
        this.aperture = aperture;
        this.focalLength = focalLength;

        this.eyepieceFocalLenght = null;
        this.magnification = null;

        this.ra = null;
        this.dec = null;
        this.alt = null;
        this.az = null;
    }

    // Sets the eyepiece focal length and calculates the magnification
    // simulates the effect of changing the eyepiece on the telescope
    setEyepieceFocalLength( eyepieceFocalLenght ) {
        this.eyepieceFocalLenght = eyepieceFocalLenght;
        this.magnification = this.focalLength / this.eyepieceFocalLenght;
    }

    // Sets the telescope's position in the sky using right ascension and declination
    setPosition( ra, dec ) {
        this.ra = ra;
        this.dec = dec;
    }

    // Sets the telescope's position in the sky using altitude and azimuth
    setAltAz( alt, az ) {
        this.alt = alt;
        this.az = az;
    }

    getRaDec() {
        return { ra: this.ra, dec: this.dec };
    }

    getAltAz() {
        return { alt: this.alt, az: this.az };
    }
}