$(function () {
    setInterval(function () {
        var arr = []
        var aller_pref = []
        $.get('/getitems', function (data) {
            $(".container").html('<h1>Kitchen</h1><div class="injector0"></div><div class="injector1"></div><div class="injector2"></div><div class="injector3"></div>');
            arr = data.arr
            aller_pref = data.aller_pref




            // var arr = [{
            //         "id": "200",
            //         "group": "200",
            //         "item": "masala fries",
            //         "price": "200",
            //         "quantity": "10",
            //         "paid": false,
            //         "done": true
            //     },
            //
            //     {
            //         "id": "223",
            //         "group": "200",
            //         "item": "mojito",
            //         "price": "300",
            //         "quantity": "10",
            //         "done": false,
            //         "paid": false
            //     },
            //
            //     {
            //         "id": "240",
            //         "group": "200",
            //         "item": "nothing",
            //         "price": "300",
            //         "quantity": "10",
            //         "done": false,
            //         "paid": false
            //     },
            //
            //     {
            //         "id": "40",
            //         "group": "200",
            //         "item": "nothing",
            //         "price": "300",
            //         "quantity": "10",
            //         "done": true,
            //         "paid": false
            //     },
            //
            //     {
            //         "id": "232",
            //         "group": "210",
            //         "item": "cheesy fries",
            //         "price": "200",
            //         "quantity": "10",
            //         "done": true,
            //         "paid": false
            //     },
            //
            //     {
            //         "id": "240",
            //         "group": "210",
            //         "item": "Jaigerbomb",
            //         "price": "200",
            //         "quantity": "10",
            //         "done": true,
            //         "paid": false
            //     },
            //
            //
            //
            //
            //
            // ]


            //
            // var aller_pref = {
            //     "200": {
            //         "allergies": "Allergic to garlic",
            //         "preferences": "Meat cooked to medium rare"
            //     },
            //     "222": {
            //         "allergies": "Allergic to garlic",
            //         "preferences": "Meat cooked to medium rare"
            //     }
            // }


            var poparr = {}

            for (var key in arr) {
                if (poparr[arr[key].id]) {
                    poparr[arr[key].id].push({
                        "group": arr[key].group,
                        "id": arr[key].id,
                        "item": arr[key].item,
                        "price": arr[key].price,
                        "paid": arr[key].paid,
                        "quantity": arr[key].quantity,
                        "orderkey": key,
                        "done": arr[key].done
                    })
                } else {
                    poparr[arr[key].id] = [{
                        "id": arr[key].id,
                        "group": arr[key].group,
                        "item": arr[key].item,
                        "price": arr[key].price,
                        "paid": arr[key].paid,
                        "quantity": arr[key].quantity,
                        "orderkey": key,
                        "done": arr[key].done
                    }]
                }

            }

            var table = `
    <table class="table table-hover table-inverse" style="max-width: 60px; font-size:10px; margin:10px">
  <thead>
    <tr>
      <th>#</th>
      <th>Item</th>
      <th>Quantity</th>
      <th>Price</th>
      <th>isPaid?</th>
    </tr>
  </thead>
  <tbody>`

            //     <tr>
            //       <th scope="row">1</th>
            //       <td>Mark</td>
            //       <td>Otto</td>
            //       <td>@mdo</td>
            //     </tr>
            //     <tr>
            //       <th scope="row">2</th>
            //       <td>Jacob</td>
            //       <td>Thornton</td>
            //       <td>@fat</td>
            //     </tr>
            //     <tr>
            //       <th scope="row">3</th>
            //       <td colspan="2">Larry the Bird</td>
            //       <td>@twitter</td>
            //     </tr>
            //   </tbody>
            // </table>

            var table = `
<table class="table table-inverse" style="max-width: 60px; font-size:10px; margin:10px">
<thead>
<tr>
  <th colspan="3" class="big">PERSON# `

            var tablesplt = `</th>
</tr>
<tr>
  <th>#</th>
  <th>Item</th>
  <th>Quantity</th>
  <th>Price</th>
  <th>isPaid?</th>
  <th> Done? </th>
</tr>
</thead>
<tbody>`




            var count = 0;
            var maincount = 0;
            for (var key in poparr) {
                maincount++;
                var remain = table + key + "</th><th colspan=\"3\" class=\"big\">TABLE# " + poparr[key][0].group + tablesplt;
                for (key2 in poparr[key]) {

                    if (poparr[key][key2].done) {
                        remain = remain + "<tr class=\"green\">"
                    } else {
                        remain = remain + "<tr>"
                    }


                    remain = remain + "<td>" + (++count) + "</td>"
                    remain = remain + "<td>" + poparr[key][key2].item + "</td>"
                    remain = remain + "<td>" + poparr[key][key2].quantity + "</td>"
                    remain = remain + "<td>" + poparr[key][key2].price + "</td>"
                    remain = remain + "<td>" + poparr[key][key2].paid + "</td>"


                    if (!poparr[key][key2].done) {
                        remain = remain + "<td> <button id=" + poparr[key][key2].orderkey + " + onclick=dodone(this)> Yes </button> </td>"
                    }
                    else {
                        remain = remain + "<td> done. </td>"
                    }


                    remain = remain + "</tr>"
                }

                if (aller_pref[key] && aller_pref[key].preferences && aller_pref[key].allergies) {
                    remain += "<tr > <td colspan=\"6\" class=\"grey\">Preferences: " + aller_pref[key].preferences.join(',') + "</td> </tr>"
                    remain += "<tr > <td colspan=\"6\" class=\"red\">Allergies: " + aller_pref[key].allergies.join(',') + "</td> </tr>"
                    console.log(aller_pref[key])
                } else {
                    remain += "<tr > <td colspan=\"6\" class=\"normal\">No preferences</td></tr>"
                    remain += "<tr > <td colspan=\"6\" class=\"normal\">No Allergies</td></tr>"
                }







                remain = remain + "  </tbody> </table>"


                var x = $(remain)
                var y = ".injector" + parseInt(maincount / 4)
                console.log("using" + y)
                $(y).append(x);

                console.log(remain)

            }




            console.log(poparr)
        });

        dodone = function (e) {
            $.get('/done?id='+e.id, function () {
                console.log("done. ")
                $('#' + e.id).parent().parent().addClass('addgreen')
                $('#' + e.id).parent().html("done. ")
            });
        }

    }, 1000);
});
