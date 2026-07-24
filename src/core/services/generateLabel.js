import bwipjs from 'bwip-js';

export const generateBarcodeBuffer = async (text) => {
    try {
        const png = await bwipjs.toBuffer({
            bcid: 'code128',       
            text: text,            
            scale: 3,
            height: 10,
            includetext: true,
            textxalign: 'center',
        });

        return png;
    } catch (err) {
        throw new Error('Barcode generation failed');
    }
};