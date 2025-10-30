
document.getElementById('processButton').addEventListener('click', () => {
    const fileInput = document.getElementById('file');

    if (fileInput.files.length === 0) {
        alert('Por favor, selecciona un archivo XML.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {
        let xmlContent = event.target.result;

       // ✅ Limpieza robusta de XML:
xmlContent = xmlContent
  // Reemplaza & sueltos por &amp;
  .replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;')
  // Elimina caracteres ilegales para XML 1.0
  .replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/g, '');


        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

        const parserError = xmlDoc.getElementsByTagName('parsererror');
        if (parserError.length > 0) {
            alert('❌ El archivo XML tiene errores graves y no pudo ser leído.');
            console.error(parserError[0].textContent);
            return;
        }

        let emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0];
        let rfcEmisor = emisor?.getAttribute('Rfc') || '000000';
        if (rfcEmisor === 'ACM040107U93') {
            rfcEmisor = '001488';
        }

        let numeroTienda = '000000';
        let centroCostoAttr = null;

        const allNodes = xmlDoc.getElementsByTagName('*');
        for (let i = 0; i < allNodes.length; i++) {
            const attrs = allNodes[i].attributes;
            for (let j = 0; j < attrs.length; j++) {
                const attrName = attrs[j].name.trim().toUpperCase();
                if (attrName === 'CENTROCOSTO') {
                    centroCostoAttr = attrs[j].value.trim();
                    break;
                }
            }
            if (centroCostoAttr) break;
        }

        if (centroCostoAttr) {
            const match = centroCostoAttr.match(/(\d{4})-(\d{4})/);
            if (match) {
                const parte1 = match[1].substring(2);
                const parte2 = match[2];
                numeroTienda = `${parte1}${parte2}`.padStart(6, '0');
            }
        } else {
            alert('⚠️ No se encontró el atributo CENTROCOSTO. Se usará 000000.');
        }

        console.log('CENTROCOSTO encontrado:', centroCostoAttr);
        console.log('Número tienda final:', numeroTienda);

        const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0];
        const fechaOriginal = comprobante?.getAttribute('Fecha') || '';
        const fechaObj = new Date(fechaOriginal);
        const fechaFormateada = fechaObj.toLocaleDateString('en-US');
        const folio = comprobante?.getAttribute('Folio') || 'SIN_FOLIO';

        const Total = parseFloat(comprobante?.getAttribute('Total') || '0').toFixed(2);

        let impuestosTrasladados = '0.00';
        for (let i = 0; i < allNodes.length; i++) {
            const node = allNodes[i];
            if (node.hasAttribute('TotalImpuestosTrasladados')) {
                impuestosTrasladados = node.getAttribute('TotalImpuestosTrasladados');
                break;
            }
        }

        let tarifaImporte = '';
        const conceptos = xmlDoc.getElementsByTagName('cfdi:Concepto');
        const detalles = [];

        for (let i = 0; i < conceptos.length; i++) {
            const concepto = conceptos[i];
            const noIdent = concepto.getAttribute('NoIdentificacion') || '000000';
            const cantidad = concepto.getAttribute('Cantidad') || '0.00';
            const valorUnitario = concepto.getAttribute('ValorUnitario') || '0.00';
            const importe = concepto.getAttribute('Importe') || '0.00';

            if (noIdent === 'TARIFA') {
                tarifaImporte = importe;
            } else {
                detalles.push(`D\t${noIdent}\tN\t${cantidad}\t${valorUnitario}\t${importe}`);
            }
        }

        let descuentoLinea = '';
        const condicionesPago = comprobante?.getAttribute('CondicionesDePago');
        const descuento = comprobante?.getAttribute('Descuento');
        const exportacion = comprobante?.getAttribute('Exportacion');

        if (condicionesPago && descuento && exportacion) {
            descuentoLinea = `-${parseFloat(descuento).toFixed(2)}`;
        }

        let cabecera = `H\t${rfcEmisor.padStart(6, '0')}\t${numeroTienda.padStart(6, '0')}\t\t${fechaFormateada}\t${folio}\t${fechaFormateada}\t${Total}\tIVA (TAX)\t${impuestosTrasladados}`;
        if (tarifaImporte) {
            cabecera += `\tDISTRIBUCION Y ALMACENAJE FLETE\t${tarifaImporte}`;
        }
        if (descuentoLinea) {
            cabecera += `\t DESCUENTO EN FLETES\t${descuentoLinea}`;
        }

        const contenidoFinal = [cabecera, ...detalles].join('\n');

        const blob = new Blob([contenidoFinal], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `009${folio}.txt`;
        link.click();
    };

    reader.readAsText(file);
});
