| initial lat | bearing | "rotation" lat* | "rotation" lon* |
| ----------: | ------: | --------------: | --------------: |
|   90        |   10    |   0             |   10            |
|   45        |   10    |   5             |   5             |
|   22.5      |   10    |   7.5           |   2.5           |
|   0         |   10    |   10            |   0             |
|  -22.5      |   10    |   7.5           |  -2.5           |
|  -45        |   10    |   5             |  -05            |
|  -90        |   10    |   0             |  -10            |
|   ---       |  ---    |  ---            |  ---            |
|   90        |  -30    |  -0             |  -30            |
|   45        |  -30    |  -15            |  -15            |
|   22.5      |  -30    |  -22.5          |  -7.5           |
|   0         |  -30    |  -30            |   0             |
|  -22.5      |  -30    |  -22.5          |   7.5           |
|  -45        |  -30    |  -15            |   15            |
|  -90        |  -30    |  -0             |   30            |



*the adjustments to the next point along the wrap-around line,
 which is at (+0 deg lat, +90 deg lon) from the initial coastline point
 and prior to making these "rotation" adjustments



positive bearing:
- lat always positive
- lon same sign as initial lat

 ```   
rLat = Math.abs((1 - (iLat  / 90)) * b)
rLat = Math.abs((1 - (-iLat / 90)) * b)
rLon = (iLat  / 90) * b
rLon = (-iLat / 90) * b
```

negative bearing:
- lat always negative
- lon opposite sign as initial lat

```  
rLat = -Math.abs((1 - (iLat  / 90)) * -b)
rLat = -Math.abs((1 - (-iLat / 90)) * -b)
rLon = (iLat  / 90) * -b
rLon = (-iLat / 90) * -b
```

initial lat:
- range: 0 to +/-90
- when increasing initial lat, use bearing as the seed value: less lat adj, more lon adj

